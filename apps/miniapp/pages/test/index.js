var FORMS = [{label:'血糖记录',fields:[{id:'metric',label:'指标',options:[{v:'blood_glucose',l:'血糖'},{v:'blood_pressure',l:'血压'},{v:'heart_rate',l:'心率'},{v:'weight',l:'体重'},{v:'temperature',l:'体温'},{v:'spo2',l:'血氧'}],selIdx:0,selLabel:'血糖'},{id:'value',label:'数值',type:'dial',
  ranges:{blood_glucose:{min:1.0,max:30.0,unit:'mmol/L',normal:5.5},blood_pressure:{min:60,max:250,unit:'mmHg',normal:120},heart_rate:{min:30,max:220,unit:'bpm',normal:72},weight:{min:20,max:300,unit:'kg',normal:65},temperature:{min:34.0,max:43.0,unit:'°C',normal:36.5},spo2:{min:50,max:100,unit:'%',normal:98}}
},{id:'context',label:'场景',type:'picker',options:[{v:'fasting',l:'空腹'},{v:'postprandial',l:'餐后'},{v:'bedtime',l:'睡前'},{v:'random',l:'随机'}]}]},{label:'血压记录',fields:[{id:'metric',label:'指标',options:[{v:'blood_glucose',l:'血糖'},{v:'blood_pressure',l:'血压'},{v:'heart_rate',l:'心率'},{v:'weight',l:'体重'},{v:'temperature',l:'体温'},{v:'spo2',l:'血氧'}],selIdx:1,selLabel:'血压'},{id:'value',label:'数值',type:'dial',
  ranges:{blood_glucose:{min:1.0,max:30.0,unit:'mmol/L',normal:5.5},blood_pressure:{min:60,max:250,unit:'mmHg',normal:120},heart_rate:{min:30,max:220,unit:'bpm',normal:72},weight:{min:20,max:300,unit:'kg',normal:65},temperature:{min:34.0,max:43.0,unit:'°C',normal:36.5},spo2:{min:50,max:100,unit:'%',normal:98}}
},{id:'context',label:'场景',type:'picker',options:[{v:'resting',l:'静息'},{v:'exercise',l:'运动后'},{v:'random',l:'随机'}]}]}]
var SPEED=[{name:'fastUp',f:0,t:0.2,s:4,c:'#2E7D32'},{name:'slowUp',f:0.2,t:0.4,s:0.5,c:'#66BB6A'},{name:'center',f:0.4,t:0.6,s:0,c:'#E0E0E0'},{name:'slowDown',f:0.6,t:0.8,s:-0.5,c:'#EF9A9A'},{name:'fastDown',f:0.8,t:1,s:-4,c:'#C62828'}]

function mf(f){var c={id:f.id,label:f.label,type:f.type,options:f.options,ranges:f.ranges,selIdx:f.selIdx||-1,selLabel:f.selLabel||'',hlIdx:-1,done:false}
  if(c.type==='dial'){var r=c.ranges&&c.ranges[Object.keys(c.ranges)[0]];if(r){c.min=r.min;c.max=r.max;c.unit=r.unit}}
  return c}

Page({data:{},fi:0,cr:null,dt:null,cv:0,dwt:null,dwa:false,dws:0,cc:-1,pc:-1,locked:[],
  onLoad(){var s=this;wx.createSelectorQuery().select('.test-canvas').boundingClientRect().exec(function(r){if(r[0])s.cr=r[0]});this._pxr=wx.getSystemInfoSync().screenWidth/750;this._lf(0)},

  _lf(idx,kp){if(idx>=FORMS.length){this.setData({ad:true,pv:false});return}
    this._sd();this._sdia();this.cc=-1;this.pc=-1;this.fi=idx;this.locked=[]
    var odd=idx%2===0,fds=FORMS[idx].fields.map(function(f){return mf(f)}),m=null,cf=[]
    for(var i=0;i<fds.length;i++){if(fds[i].id==='metric'){m=fds[i];continue}cf.push(fds[i])}
    for(var k=0;k<cf.length;k++){if(cf[k].type==='dial'){cf[k].done=true;cf[k].selIdx=1;}}
    if(m&&m.selIdx>=0){var mk=m.options[m.selIdx].v;for(var j=0;j<cf.length;j++){if(cf[j].type==='dial'&&cf[j].ranges&&cf[j].ranges[mk]){var r=cf[j].ranges[mk];cf[j].min=r.min;cf[j].max=r.max;cf[j].unit=r.unit;cf[j].selLabel=String(r.normal.toFixed(Number(r.min)%1!==0||Number(r.max)%1!==0?1:0));this.cv=r.normal}}}
    var guide=odd?'←按住向右':'按住向左→';var os=odd?'提交→':'←提交';var slk=[]
    var s=this;this.setData({fl:FORMS[idx].label,metric:m,chainFields:cf,ad:false,guide:guide,otherLabel:os,ht:odd?'从左向右通过选项·右端停留提交':'从右向左通过选项·左端停留提交',lza:false,rza:false,ac:-1,dp:0,dbv:false,dz:SPEED,daz:'',dlv:false,lf:false,stl:0,snk:slk,pv:!!kp,odd:odd});setTimeout(function(){s._qr()},300)},

  _qr(){var s=this;wx.createSelectorQuery().selectAll('.test-col').boundingClientRect().exec(function(r){if(r[0]){s.colsRects=r[0];s._uc()}})},
  _pick(ci,y){var cs=this.colsRects,cf=this.data.chainFields;if(this.locked[ci])return-1;if(!cs||!cs[ci]||!cf||!cf[ci])return-1;var n=cf[ci].options.length;if(!n)return-1;var cr=cs[ci];var labelPx=Math.round(48*this._pxr);var av=cr.height-labelPx-12;var ph=Math.max(20,av/n);var idx=Math.floor((y-cr.top-labelPx-12)/ph);if(idx<0)idx=0;if(idx>=n)idx=n-1;return idx},
  _uc(){var cs=this.colsRects,cf=this.data.chainFields;if(!cs||!cf)return;var labelPx=Math.round(48*this._pxr);var cons=[];for(var i=0;i<cf.length-1;i++){if(cf[i].done&&cf[i+1].done&&cs[i]&&cs[i+1]&&cf[i].selIdx>=0&&cf[i+1].selIdx>=0){var av1=cs[i].height-labelPx-12,av2=cs[i+1].height-labelPx-12;var n1=cf[i].options.length,n2=cf[i+1].options.length;var ph1=Math.max(20,av1/n1),ph2=Math.max(20,av2/n2);var y1=cs[i].top+labelPx+12+(cf[i].selIdx+0.5)*ph1;var y2=cs[i+1].top+labelPx+12+(cf[i+1].selIdx+0.5)*ph2;var midY=(y1+y2)/2;cons.push({x1:cs[i].left+cs[i].width,y:midY,w:cs[i+1].left-(cs[i].left+cs[i].width)})}}this.setData({connectors:cons})},

  /** Lock column ci with settle animation */
  _lock(ci){if(this.locked[ci])return;this.locked[ci]=true;var cf=this.data.chainFields.slice();var f=cf[ci];if(f.type==='dial'){f.done=true;f.selIdx=1;var dec=Number(f.min)%1!==0||Number(f.max)%1!==0?1:0;f.selLabel=String(this.cv.toFixed(dec));this.setData({chainFields:cf,stl:1});var s=this;setTimeout(function(){s.setData({stl:2})},400);setTimeout(function(){s.setData({stl:3})},700)}
    else if(f.type==='picker'&&f.hlIdx>=0){f.selIdx=f.hlIdx;f.selLabel=f.options[f.hlIdx].l;f.hlIdx=-1;f.done=true;wx.vibrateShort({type:'light'})}
    this.setData({chainFields:cf})},

  canAccess(ci){if(ci===0)return true;return this.locked[0]===true},

  onMetricTap(e){var idx=Number(e.currentTarget.dataset.idx);if(isNaN(idx))return;var m=this.data.metric;m.selIdx=idx;m.selLabel=m.options[idx].l;var mk=m.options[idx].v;var cf=this.data.chainFields.slice();for(var i=0;i<cf.length;i++){if(cf[i].type==='dial'&&cf[i].ranges&&cf[i].ranges[mk]){var r=cf[i].ranges[mk];cf[i].min=r.min;cf[i].max=r.max;cf[i].unit=r.unit;var dec=Number(r.min)%1!==0||Number(r.max)%1!==0?1:0;this.cv=r.normal;cf[i].selLabel=String(r.normal.toFixed(dec))}}wx.vibrateShort({type:'light'});this.setData({metric:m,chainFields:cf})},

  _z(fx){var odd=this.fi%2===0,e=0.08,cf=this.data.chainFields,n=cf?cf.length:2;if(odd){if(fx>1-e)return'submit'}else{if(fx<e)return'submit'};if(odd){if(fx<e)return'guide'}else{if(fx>1-e)return'guide'};var ci=Math.floor((fx-e)/(1-2*e)*n);if(ci<0)ci=0;if(ci>=n)ci=n-1;return ci},

  _sda(){this._sd();this.dwa=true;this.dws=Date.now();this.setData({dbv:true});this._td()},
  _td(){if(!this.dwa)return;var pct=Math.min(80,(Date.now()-this.dws)/10);this.setData({dp:pct});if(pct>=80){this._od();return}var s=this;this.dwt=setTimeout(function(){s._td()},30)},
  _sd(){this.dwa=false;if(this.dwt){clearTimeout(this.dwt);this.dwt=null};this.setData({dp:0,dbv:false})},
  _od(){this.dwa=false;this.setData({dp:0,dbv:false});this._sf()},
  _sf(){this._sd();this._sdia();wx.vibrateShort({type:'heavy'});this.setData({lf:true,lza:false,rza:false,pv:true});var s=this;setTimeout(function(){s.setData({lf:false});s._lf(s.fi+1,true)},350)},

  _dm(t,ci){if(!this.canAccess(ci)||this.locked[ci])return;var s=this;var crs=this.colsRects;if(crs&&crs[ci])this.dr=crs[ci];if(!this.dr)return;var frac=(t.pageY-this.dr.top)/this.dr.height;if(frac<0)frac=0;if(frac>1)frac=1;var zn=null;for(var i=0;i<SPEED.length;i++){if(frac>=SPEED[i].f&&frac<=SPEED[i].t){zn=SPEED[i];break}}if(!zn)return;this.setData({daz:zn.name,dlv:zn.s!==0});this._sdia();if(zn.s!==0){this.dt=setInterval(function(){s._dtk(zn.s)},100)}},
  _dtk(speed){var cf=this.data.chainFields.slice();var f=cf[this.data.ac];if(!f||!f.ranges)return;var rng=Object.values(f.ranges)[0];if(!rng)return;var range=rng.max-rng.min;var pct=speed*0.01;var inc=range*pct;if(!this.cv||isNaN(this.cv))this.cv=rng.normal;var v=Number(this.cv)+inc;if(v<f.min)v=f.min;if(v>f.max)v=f.max;var dec=Number(f.min)%1!==0||Number(f.max)%1!==0?1:0;this.cv=v;var disp=v.toFixed(dec);f.selIdx=1;f.selLabel=disp;this.setData({chainFields:cf,dv:disp})},
  _sdia(){if(this.dt){clearInterval(this.dt);this.dt=null}},

  onStart(e){this.locked=[];var t=e.touches[0];this.setData({pv:true,px:t.pageX-20,py:t.pageY-20,trail:[{x:t.pageX-4,y:t.pageY-4,o:1,w:12}]})},
  onMove(e){var t=e.touches[0],r=this.cr;if(!r)return;var z=this._z((t.pageX-r.left)/r.width),odd=this.fi%2===0;var cf=this.data.chainFields.slice();if(!cf)return
    if(z==='guide'){this._sd();this._sdia();this.setData({lza:odd,rza:!odd})}
    else if(z==='submit'){this._sdia();var as=cf.every(function(f){return f.selIdx>=0});if(as){this.setData({lza:!odd,rza:odd});if(!this.dwa)this._sda()}}
    else if(typeof z==='number'){this._sd();this.setData({lza:false,rza:false})
      if(this.cc!==z){// Column transition: lock previous column
        if(this.pc>=0&&this.pc<cf.length&&!this.locked[this.pc]){this._lock(this.pc)}
        if(this.pc>=0&&this.pc<cf.length)cf[this.pc].hlIdx=-1
        this.pc=this.cc;this.cc=z}
      this.setData({ac:z});var f=cf[z];if(!f||this.locked[z])return
      if(f.type==='picker'){var idx=this._pick(z,t.pageY);if(idx>=0&&f.hlIdx!==idx){f.hlIdx=idx;this.setData({chainFields:cf})}}
      if(f.type==='dial')this._dm(t,z)}
    var tr=this.data.trail.slice();if(tr.length>50)tr.shift();tr.push({x:t.pageX-4,y:t.pageY-4,o:1,w:10});for(var i=0;i<tr.length-1;i++){tr[i].o=(i+1)/tr.length;tr[i].w=4+6*(i/tr.length)}
    this.setData({px:t.pageX-20,py:t.pageY-20,trail:tr})},

  onEnd(e){var t=e.changedTouches[0],r=this.cr;if(!r)return;var z=this._z((t.pageX-r.left)/r.width),cf=this.data.chainFields.slice();if(!cf)return;this._sd();this._sdia()
    if(z==='submit'&&cf.every(function(f){return f.selIdx>=0})){if(this.cc>=0&&this.cc<cf.length&&!this.locked[this.cc])this._lock(this.cc);this._sf();return}
    if(typeof z==='number'){var f=cf[z];if(f&&!this.locked[z]){if(f.type==='picker'&&f.hlIdx>=0){this._lock(z)}else if(f.type==='dial'){this._lock(z)}}}
    // Finger released: unlock all, clear picks, keep dial values
    for(var i=0;i<cf.length;i++){if(cf[i].type==='picker'){cf[i].selIdx=-1;cf[i].selLabel='';cf[i].done=false;cf[i].hlIdx=-1}}
    this.locked=[];this.setData({chainFields:cf,lza:false,rza:false,ac:-1,dlv:false,daz:''});this.cc=-1;this.pc=-1;this._uc()},
  reset(){this._sdia();this._sd();this.setData({pv:false,trail:[]});this._lf(0)},
})
