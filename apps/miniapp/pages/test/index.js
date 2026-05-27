var FORMS = [{label:'血糖记录',fields:[{id:'metric',label:'指标',options:[{v:'blood_glucose',l:'血糖'},{v:'blood_pressure',l:'血压'},{v:'heart_rate',l:'心率'},{v:'weight',l:'体重'},{v:'temperature',l:'体温'},{v:'spo2',l:'血氧'}],selIdx:0,selLabel:'血糖'},{id:'value',label:'数值',type:'dial',def:5.5,min:1.0,max:30.0,unit:'mmol/L',step:0.1,dec:1,ranges:{blood_glucose:{min:1.0,max:30.0,unit:'mmol/L',step:0.1,dec:1},blood_pressure:{min:60,max:250,unit:'mmHg',step:1,dec:0},heart_rate:{min:30,max:220,unit:'bpm',step:1,dec:0},weight:{min:20,max:300,unit:'kg',step:0.5,dec:1},temperature:{min:34.0,max:43.0,unit:'°C',step:0.1,dec:1},spo2:{min:50,max:100,unit:'%',step:1,dec:0}}},{id:'context',label:'场景',type:'picker',options:[{v:'fasting',l:'空腹'},{v:'postprandial',l:'餐后'},{v:'bedtime',l:'睡前'},{v:'random',l:'随机'}]}]},{label:'血压记录',fields:[{id:'metric',label:'指标',options:[{v:'blood_glucose',l:'血糖'},{v:'blood_pressure',l:'血压'},{v:'heart_rate',l:'心率'},{v:'weight',l:'体重'},{v:'temperature',l:'体温'},{v:'spo2',l:'血氧'}],selIdx:1,selLabel:'血压'},{id:'value',label:'数值',type:'dial',def:120,min:60,max:250,unit:'mmHg',step:1,dec:0,ranges:{blood_glucose:{min:1.0,max:30.0,unit:'mmol/L',step:0.1,dec:1},blood_pressure:{min:60,max:250,unit:'mmHg',step:1,dec:0},heart_rate:{min:30,max:220,unit:'bpm',step:1,dec:0},weight:{min:20,max:300,unit:'kg',step:0.5,dec:1},temperature:{min:34.0,max:43.0,unit:'°C',step:0.1,dec:1},spo2:{min:50,max:100,unit:'%',step:1,dec:0}}},{id:'context',label:'场景',type:'picker',options:[{v:'resting',l:'静息'},{v:'exercise',l:'运动后'},{v:'random',l:'随机'}]}]}]

var SPEED=[{name:'fastUp',f:0,t:0.20,s:4,c:'#2E7D32'},{name:'slowUp',f:0.20,t:0.40,s:0.5,c:'#66BB6A'},{name:'center',f:0.40,t:0.60,s:0,c:'#E0E0E0'},{name:'slowDown',f:0.60,t:0.80,s:-0.5,c:'#EF9A9A'},{name:'fastDown',f:0.80,t:1,s:-4,c:'#C62828'}]

function mkField(f,i){return{id:f.id,label:f.label,type:f.type,options:f.options,def:f.def,min:f.min,max:f.max,unit:f.unit,step:f.step,dec:f.dec,ranges:f.ranges,selIdx:f.selIdx||-1,selLabel:f.selLabel||'',hlIdx:-1,done:false}}
function buildChain(cf,ac){var n=[],l=[];for(var i=0;i<cf.length;i++){n.push({locked:cf[i].done,active:i===ac,label:cf[i].done?cf[i].selLabel:''});if(i<cf.length-1)l.push({active:cf[i].done})}return{nodes:n,links:l}}

Page({data:{},fi:0,cr:null,dr:null,dt:null,cv:0,dwt:null,dwa:false,dws:0,cc:-1,pc:-1,colsRects:[],
  onLoad(){var s=this;wx.createSelectorQuery().select('.test-canvas').boundingClientRect().exec(function(r){if(r[0])s.cr=r[0]});this._lf(0)},
  _lf(idx,kp){if(idx>=FORMS.length){this.setData({allDone:true,pv:false});return}
    this._sd();this._sdia();this.cc=-1;this.pc=-1;this.fi=idx;this.colsRects=[]
    var odd=idx%2===0,fds=FORMS[idx].fields.map(function(f,i){return mkField(f,i)}),m=null,cf=[]
    for(var i=0;i<fds.length;i++){if(fds[i].id==='metric'){m=fds[i];continue}cf.push(fds[i])}
    for(var k=0;k<cf.length;k++){if(cf[k].type==='dial'&&cf[k].def!==undefined){this.cv=cf[k].def;cf[k].selIdx=1;cf[k].selLabel=String(cf[k].def.toFixed(cf[k].dec||0))}}
    if(m&&m.selIdx>=0){var mk=m.options[m.selIdx].v;for(var j=0;j<cf.length;j++){if(cf[j].type==='dial'&&cf[j].ranges&&cf[j].ranges[mk]){var r=cf[j].ranges[mk];cf[j].min=r.min;cf[j].max=r.max;cf[j].unit=r.unit;cf[j].step=r.step;cf[j].dec=r.dec}}}
    var ch=buildChain(cf,-1)
    this.setData({fl:FORMS[idx].label,metric:m,chainFields:cf,ad:false,ll:odd?'提交':'取消',rl:odd?'取消':'提交',ht:odd?'从右向左滑·左端停留提交':'从左向右滑·右端停留提交',lza:false,rza:false,ac:-1,dp:0,dbv:false,dz:SPEED,daz:'',dlv:false,lf:false,pv:!!kp,chain:ch.nodes,chainLinks:ch.links,odd:odd})
    // Pre-query column rects after render
    var s=this;setTimeout(function(){s._qCols()},200)
  },
  _qCols(){var s=this;wx.createSelectorQuery().selectAll('.test-col').boundingClientRect().exec(function(r){if(r[0])s.colsRects=r[0]})},

  onMetricTap(e){var idx=Number(e.currentTarget.dataset.idx);if(isNaN(idx))return;var m=this.data.metric;m.selIdx=idx;m.selLabel=m.options[idx].l;var mk=m.options[idx].v;var cf=this.data.chainFields.slice();for(var i=0;i<cf.length;i++){if(cf[i].type==='dial'&&cf[i].ranges&&cf[i].ranges[mk]){var r=cf[i].ranges[mk];cf[i].min=r.min;cf[i].max=r.max;cf[i].unit=r.unit;cf[i].step=r.step;cf[i].dec=r.dec}}wx.vibrateShort({type:'light'});this.setData({metric:m,chainFields:cf})},

  _z(fx){var odd=this.fi%2===0,e=0.08,cf=this.data.chainFields,n=cf?cf.length:2;if(fx<e)return odd?'submit':'cancel';if(fx>1-e)return odd?'cancel':'submit';var ci=Math.floor((fx-e)/(1-2*e)*n);if(ci<0)ci=0;if(ci>=n)ci=n-1;return ci},

  /** Pick option from Y relative to column top */
  _pickOpt(t,ci){var cols=this.colsRects;if(!cols||!cols[ci])return-1;var cr=cols[ci];var dy=t.pageY-cr.top;var cf=this.data.chainFields;var n=(cf&&cf[ci]&&cf[ci].options)?cf[ci].options.length:1;var h=cr.height/n;var idx=Math.floor(dy/h);if(idx<0)idx=0;if(idx>=n)idx=n-1;return idx},

  _sd(){this.dwa=false;if(this.dwt){clearTimeout(this.dwt);this.dwt=null};this.setData({dp:0,dbv:false})},
  _sda(){this._sd();this.dwa=true;this.dws=Date.now();this.setData({dbv:true});this._td()},
  _td(){if(!this.dwa)return;var pct=Math.min(100,(Date.now()-this.dws)/10);this.setData({dp:pct});if(pct>=100){this._od();return}var s=this;this.dwt=setTimeout(function(){s._td()},30)},
  _od(){this.dwa=false;this.setData({dp:0,dbv:false});this._sf()},
  _sf(){this._sd();this._sdia();wx.vibrateShort({type:'heavy'});this.setData({lf:true,lza:false,rza:false,pv:true});var s=this;setTimeout(function(){s.setData({lf:false});s._lf(s.fi+1,true)},350)},
  _cf(){this._sd();this._sdia();this.cc=-1;this.pc=-1;wx.vibrateShort({type:'heavy'});this._lf(this.fi)},
  _dm(t,ci){var s=this;var crs=this.colsRects;if(crs&&crs[ci]){this.dr=crs[ci]};if(!this.dr)return;var frac=(t.pageY-this.dr.top)/this.dr.height;if(frac<0)frac=0;if(frac>1)frac=1;var zn=null;for(var i=0;i<SPEED.length;i++){if(frac>=SPEED[i].f&&frac<=SPEED[i].t){zn=SPEED[i];break}}if(!zn)return;this.setData({daz:zn.name,dlv:zn.s!==0});this._sdia();if(zn.s!==0){this.dt=setInterval(function(){s._dtk(zn.s)},100)}},
  _dtk(speed){var cf=this.data.chainFields.slice();var f=cf[this.data.ac];if(!f)return;var v=Number(this.cv)+speed*(f.step||0.1);if(v<f.min)v=f.min;if(v>f.max)v=f.max;this.cv=v;var disp=v.toFixed(f.dec||0);f.selIdx=1;f.selLabel=disp;this.setData({chainFields:cf,dv:disp})},
  _sdia(){if(this.dt){clearInterval(this.dt);this.dt=null}},

  onStart(e){var t=e.touches[0];this.setData({pv:true,px:t.pageX-20,py:t.pageY-20,trail:[{x:t.pageX-4,y:t.pageY-4,o:1,w:12}]})},
  onMove(e){
    var t=e.touches[0],r=this.cr;if(!r)return;var z=this._z((t.pageX-r.left)/r.width),odd=this.fi%2===0;var cf=this.data.chainFields.slice();if(!cf)return
    if(z==='cancel'){this._sd();this._sdia();this.setData({lza:odd,rza:!odd})}
    else if(z==='submit'){this._sdia();var as=cf.every(function(f){return f.selIdx>=0});if(as){this.setData({lza:!odd,rza:odd});if(!this.dwa)this._sda()}}
    else if(typeof z==='number'){
      this._sd();this.setData({lza:false,rza:false})
      if(this.cc!==z){if(this.pc>=0&&this.pc<cf.length)cf[this.pc].hlIdx=-1;this.pc=this.cc;this.cc=z}
      this.setData({ac:z});var f=cf[z];if(!f)return
      if(f.type==='picker'){var idx=this._pickOpt(t,z);if(idx>=0&&f.hlIdx!==idx){f.hlIdx=idx;this.setData({chainFields:cf})}}
      if(f.type==='dial')this._dm(t,f,cf)
    }
    var tr=this.data.trail.slice();if(tr.length>50)tr.shift();tr.push({x:t.pageX-4,y:t.pageY-4,o:1,w:10});for(var i=0;i<tr.length-1;i++){tr[i].o=(i+1)/tr.length;tr[i].w=4+6*(i/tr.length)}
    this.setData({px:t.pageX-20,py:t.pageY-20,trail:tr})
  },
  onEnd(e){
    var t=e.changedTouches[0],r=this.cr;if(!r)return;var z=this._z((t.pageX-r.left)/r.width),cf=this.data.chainFields.slice();if(!cf)return;this._sd();this._sdia()
    if(z==='cancel'){this._cf();return}
    if(z==='submit'&&cf.every(function(f){return f.selIdx>=0})){this._sf();return}
    if(typeof z==='number'){var f=cf[z];if(f.type==='picker'&&f.hlIdx>=0){f.selIdx=f.hlIdx;f.selLabel=f.options[f.hlIdx].l;f.hlIdx=-1;f.done=true;wx.vibrateShort({type:'light'})}if(f.type==='dial'){f.done=true;f.selIdx=1;f.selLabel=String(this.cv.toFixed(f.dec||0))}}
    this.setData({chainFields:cf,lza:false,rza:false,ac:-1,dlv:false,daz:''});this.cc=-1;this.pc=-1
    var ch=buildChain(cf,-1);this.setData({chain:ch.nodes,chainLinks:ch.links})
  },
  reset(){this._sdia();this._sd();this.setData({pv:false,trail:[]});this._lf(0)},
})
