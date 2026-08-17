/**
 * 沙箱内自动化体检。静态校验测不出「点了按钮到底有没有反应」，
 * 也测不出「代码没错但界面就是错位」，所以这里在预览 iframe 内做两件事：
 * - 交互冒烟：填表、逐个点击可交互元素，观察 DOM 与表单状态是否真的变化
 * - 视觉体检：横向溢出、文本裁切、触控尺寸过小、文字对比度过低
 * 两者的结论都能直接回喂修复链路。
 */

export interface SmokeDeadTarget {
  label: string;
  reason: string;
}

export interface SmokeResult {
  /** 本次冒烟实际耗时（毫秒） */
  elapsed?: number;
  /** 是否因触达时间预算而提前收尾 */
  truncated?: boolean;
  /** 发现的可交互元素总数 */
  total: number;
  /** 实际触发的次数 */
  triggered: number;
  /** 触发后产生可见变化的次数 */
  mutated: number;
  errors: string[];
  dead: SmokeDeadTarget[];
}

export type VisualIssueKind =
  | 'overflow'
  | 'clipped'
  | 'tiny-target'
  | 'low-contrast'
  | 'offscreen';

export interface VisualIssue {
  kind: VisualIssueKind;
  label: string;
  detail: string;
}

export interface VisualResult {
  viewport: { width: number; height: number };
  issues: VisualIssue[];
  /** 本次视觉体检实际耗时（毫秒） */
  elapsed?: number;
  /** 是否因触达时间预算而提前收尾 */
  truncated?: boolean;
}

/** 宿主端整层校验的硬性时间预算：超过即按已得结论收尾 */
export const AUDIT_BUDGET_MS = 1200;

export const VISUAL_KIND_LABEL: Record<VisualIssueKind, string> = {
  overflow: '横向溢出',
  clipped: '内容被裁切',
  'tiny-target': '点击目标过小',
  'low-contrast': '文字对比度不足',
  offscreen: '元素超出可视区',
};

/**
 * 宿主 → 沙箱的指令类型。
 * `run-audit` 让沙箱在同一个任务里连续跑完冒烟与视觉，
 * 省掉「两次 postMessage 往返 + 中间人为等待」的开销。
 */
export type HostCommand = 'run-audit' | 'run-smoke' | 'run-visual';

export interface HostMessage {
  source: 'atoms-host';
  command: HostCommand;
}

export function buildHostMessage(command: HostCommand): HostMessage {
  return { source: 'atoms-host', command };
}

/**
 * 注入沙箱的体检脚本。刻意用 ES5 写法并全程 try/catch，
 * 保证即使生成代码本身有问题，体检脚本也不会连带崩掉。
 */
export const AUDIT_SCRIPT = `(function(){
  // 上限直接决定体检耗时：每个元素都要 getComputedStyle + getBoundingClientRect，
  // 都会触发同步重排，所以只抽样前若干个可见元素，保证体检在一帧级别内跑完。
  var MAX_TARGETS=8, MAX_ELEMENTS=240, MAX_ISSUES_PER_KIND=3, MAX_ISSUES=10, MAX_CONTRAST=60;
  // 时间预算是真正的护栏：元素数量上限挡不住「单个元素极慢」的情况，
  // 所以两段体检各自带一个墙钟预算，超时立刻带着已有结论返回，
  // 保证整层校验稳定落在宿主端的 2 秒预算内。
  var SMOKE_BUDGET=280, VISUAL_BUDGET=280;

  var send=function(type,payload){
    try{parent.postMessage({source:'atoms-sandbox',type:type,payload:payload},'*');}catch(e){}
  };

  var describe=function(el){
    if(!el||!el.tagName)return '未知元素';
    var name=el.tagName.toLowerCase();
    if(el.id)name+='#'+el.id;
    var text=(el.textContent||'').replace(/\\s+/g,' ').trim();
    if(!text&&el.value)text=String(el.value);
    if(text)name+=' 「'+text.slice(0,18)+'」';
    return name;
  };



  // DOM 快照同时纳入表单控件状态，避免 checkbox 这类只改属性的交互被误判为无反应
  var snapshot=function(){
    try{
      var body=document.body?document.body.innerHTML:'';
      var fields=[].slice.call(document.querySelectorAll('input,select,textarea')).map(function(el){
        return (el.type==='checkbox'||el.type==='radio')?(el.checked?'1':'0'):String(el.value||'');
      }).join('|');
      return body.length+':'+body.slice(0,4000)+'#'+fields;
    }catch(e){return '';}
  };

  // onlyEmpty=true 时只补空白控件：表单提交成功后应用通常会清空输入框，
  // 若不补填就继续点「添加」，应用会正确拒绝空输入，反而被误判成死按钮。
  var fillInputs=function(onlyEmpty){
    var filled=0;
    try{
      var nodes=[].slice.call(document.querySelectorAll('input,textarea,select'));
      nodes.forEach(function(el){
        var type=(el.type||'text').toLowerCase();
        if(type==='checkbox'||type==='radio'||type==='submit'||type==='button'||type==='file')return;
        if(onlyEmpty&&String(el.value==null?'':el.value).trim()!=='')return;
        try{
          if(el.tagName.toLowerCase()==='select'){
            if(el.options&&el.options.length>1)el.selectedIndex=1;
          }else if(type==='number'||type==='range'){
            el.value='8';
          }else if(type==='date'){
            el.value=new Date().toISOString().slice(0,10);
          }else if(type==='time'){
            el.value='09:30';
          }else{
            el.value='冒烟测试项';
          }
          el.dispatchEvent(new Event('input',{bubbles:true}));
          el.dispatchEvent(new Event('change',{bubbles:true}));
          filled++;
        }catch(e){}
      });
    }catch(e){}
    return filled;
  };

  var runSmoke=function(){
    var t0=Date.now(),truncated=false;
    var overBudget=function(){
      if(Date.now()-t0>SMOKE_BUDGET){truncated=true;return true;}
      return false;
    };
    var errors=[],dead=[],triggered=0,mutated=0;
    var onError=function(ev){
      var msg=(ev&&ev.message)||'交互过程中触发运行时错误';
      if(errors.length<8)errors.push(msg);
    };
    window.addEventListener('error',onError,true);

    var targets=[];
    try{
      targets=[].slice.call(document.querySelectorAll(
        'button,[role="button"],input[type="submit"],input[type="checkbox"],input[type="radio"],select,a[href^="#"],[onclick]'
      ));
    }catch(e){targets=[];}
    var total=targets.length;

    fillInputs();

    // 表单优先：先提交一次，覆盖「录入 → 列表新增」这条主路径
    try{
      var forms=[].slice.call(document.querySelectorAll('form'));
      forms.slice(0,2).forEach(function(f){
        if(overBudget())return;
        var before=snapshot();
        try{
          f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
          triggered++;
          if(snapshot()!==before)mutated++;
        }catch(e){errors.push('表单提交抛出异常');}
      });
    }catch(e){}

    targets.slice(0,MAX_TARGETS).forEach(function(el){
      if(overBudget())return;
      // 先把被上一次提交清空的输入框补回来，再快照，避免「拒绝空输入」被当成无反应
      fillInputs(true);
      var before=snapshot();
      try{
        if(typeof el.click==='function')el.click();
        else el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
        triggered++;
      }catch(e){
        if(errors.length<8)errors.push(describe(el)+' 点击时抛出异常');
        return;
      }
      if(snapshot()!==before){mutated++;}
      else if(dead.length<6){dead.push({label:describe(el),reason:'点击后页面与表单状态均无变化'});}
    });

    window.removeEventListener('error',onError,true);

    send('smoke',{
      total:total,
      triggered:triggered,
      mutated:mutated,
      errors:errors,
      dead:dead,
      elapsed:Date.now()-t0,
      truncated:truncated
    });
  };

  /* ----------------------------- 视觉体检 ----------------------------- */

  var parseColor=function(value){
    if(!value)return null;
    var m=String(value).match(/rgba?\\(([^)]+)\\)/);
    if(!m)return null;
    var parts=m[1].split(',').map(function(v){return parseFloat(v);});
    if(parts.length<3)return null;
    return {r:parts[0],g:parts[1],b:parts[2],a:parts.length>3?parts[3]:1};
  };

  var luminance=function(c){
    var conv=function(v){
      var s=v/255;
      return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4);
    };
    return 0.2126*conv(c.r)+0.7152*conv(c.g)+0.0722*conv(c.b);
  };

  var contrast=function(fg,bg){
    var l1=luminance(fg),l2=luminance(bg);
    var hi=Math.max(l1,l2),lo=Math.min(l1,l2);
    return (hi+0.05)/(lo+0.05);
  };

  // 向上回溯到第一个不透明背景，透明层叠时才能算出真实对比度
  var effectiveBg=function(el){
    var node=el;
    for(var i=0;i<8&&node;i++){
      try{
        var c=parseColor(getComputedStyle(node).backgroundColor);
        if(c&&c.a>0.2)return c;
      }catch(e){}
      node=node.parentElement;
    }
    return {r:255,g:255,b:255,a:1};
  };

  var hasOwnText=function(el){
    for(var i=0;i<el.childNodes.length;i++){
      var node=el.childNodes[i];
      if(node.nodeType===3&&String(node.nodeValue||'').trim().length>1)return true;
    }
    return false;
  };

  var runVisual=function(){
    var t0=Date.now(),truncated=false;
    var issues=[],counter={},contrastChecked=0;
    var push=function(kind,label,detail){
      counter[kind]=(counter[kind]||0)+1;
      if(counter[kind]>MAX_ISSUES_PER_KIND||issues.length>=MAX_ISSUES)return;
      issues.push({kind:kind,label:label,detail:detail});
    };

    var de=document.documentElement;
    var vw=de.clientWidth||0,vh=de.clientHeight||0;

    try{
      if(de.scrollWidth>vw+2){
        push('overflow','页面整体','内容宽度 '+de.scrollWidth+'px 超出视口 '+vw+'px，出现横向滚动条');
      }
    }catch(e){}

    var nodes=[];
    try{nodes=[].slice.call(document.body.querySelectorAll('*')).slice(0,MAX_ELEMENTS);}catch(e){}

    nodes.forEach(function(el){
      // 触达预算后直接跳过剩余元素：已收集到的问题照常上报
      if(Date.now()-t0>VISUAL_BUDGET){truncated=true;return;}
      var cs,rect;
      try{
        cs=getComputedStyle(el);
        if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity||'1')<0.1)return;
        rect=el.getBoundingClientRect();
      }catch(e){return;}
      if(!rect||rect.width<1||rect.height<1)return;

      if(rect.right>vw+3&&rect.width<vw){
        push('offscreen',describe(el),'右边界在 '+Math.round(rect.right)+'px，超出视口宽度 '+vw+'px');
      }

      var hiddenX=cs.overflow==='hidden'||cs.overflowX==='hidden';
      if(hiddenX&&el.scrollWidth>el.clientWidth+3&&el.clientWidth>0){
        push('clipped',describe(el),'内容宽 '+el.scrollWidth+'px 但容器只有 '+el.clientWidth+'px，文字会被截断');
      }
      var hiddenY=cs.overflow==='hidden'||cs.overflowY==='hidden';
      if(hiddenY&&el.scrollHeight>el.clientHeight+6&&el.clientHeight>0){
        push('clipped',describe(el),'内容高 '+el.scrollHeight+'px 但容器只有 '+el.clientHeight+'px，内容被遮住');
      }

      var tag=el.tagName.toLowerCase();
      var clickable=tag==='button'||tag==='a'||(tag==='input'&&(el.type==='submit'||el.type==='button'));
      if(clickable&&(rect.width<32||rect.height<26)){
        push('tiny-target',describe(el),'尺寸只有 '+Math.round(rect.width)+'×'+Math.round(rect.height)+'px，移动端不易点中');
      }

      if(hasOwnText(el)&&contrastChecked<MAX_CONTRAST){
        contrastChecked++;
        try{
          var fg=parseColor(cs.color);
          if(fg&&fg.a>0.3){
            var ratio=contrast(fg,effectiveBg(el));
            var size=parseFloat(cs.fontSize||'16');
            var bold=parseInt(cs.fontWeight||'400',10)>=600;
            var limit=(size>=24||(size>=18.66&&bold))?2.6:3.6;
            if(ratio<limit){
              push('low-contrast',describe(el),'文字与背景对比度约 '+ratio.toFixed(2)+':1，低于可读下限，请加深文字或改浅背景');
            }
          }
        }catch(e){}
      }
    });

    send('visual',{
      viewport:{width:vw,height:vh},
      issues:issues,
      elapsed:Date.now()-t0,
      truncated:truncated
    });
  };

  window.addEventListener('message',function(ev){
    var data=ev&&ev.data;
    if(!data||data.source!=='atoms-host')return;
    try{
      if(data.command==='run-audit'){runSmoke();runVisual();}
      else if(data.command==='run-smoke')runSmoke();
      else if(data.command==='run-visual')runVisual();
    }catch(e){
      send('error',{message:'体检脚本执行失败：'+(e&&e.message?e.message:'未知原因')});
    }
  });
})();`;

/* --------------------------- 结论转修复指令 --------------------------- */

/** 冒烟结果转成回喂模型的问题清单 */
export function smokeIssues(result: SmokeResult | null): string[] {
  if (!result) return [];
  const issues: string[] = [];
  if (result.errors.length) {
    issues.push(
      `【交互冒烟】模拟操作时脚本报错：${result.errors.slice(0, 3).join('；')}。请修好事件处理逻辑。`,
    );
  }
  if (result.total > 0 && result.triggered > 0 && result.mutated === 0) {
    issues.push(
      '【交互冒烟】依次触发了页面上所有按钮与表单，但界面和表单状态始终没有变化，交互完全是死的。请让事件真正修改数据并重绘界面。',
    );
  }
  if (result.dead.length) {
    issues.push(
      `【交互冒烟】以下元素点击后没有任何反应：${result.dead
        .slice(0, 4)
        .map((d) => d.label)
        .join('、')}。请为它们补上真实的处理逻辑或移除。`,
    );
  }
  // 预览沙箱里的 localStorage 是内存垫片（iframe 没有 allow-same-origin），
  // 因此「有没有写入本地存储」在这里测不出真实结论，不再作为体检项。
  return issues;
}

/** 视觉体检结果转成回喂模型的问题清单 */
export function visualIssues(result: VisualResult | null): string[] {
  if (!result || !result.issues.length) return [];
  const grouped = new Map<VisualIssueKind, VisualIssue[]>();
  result.issues.forEach((issue) => {
    const list = grouped.get(issue.kind) ?? [];
    list.push(issue);
    grouped.set(issue.kind, list);
  });
  return [...grouped.entries()].map(([kind, list]) => {
    const detail = list
      .slice(0, 3)
      .map((item) => `${item.label}（${item.detail}）`)
      .join('；')
      .slice(0, 320);
    return `【视觉体检·${VISUAL_KIND_LABEL[kind]}】${detail}。请调整样式修好这些问题。`;
  });
}