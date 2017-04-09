/*
Copyright luojia@luojia.me
LGPL license
*/
import Template from './textModuleTemplate.js';

class TextCanvas extends Template{
	constructor(dText){
		super(dText);
		this.supported=dText.text2d.supported;
		if(!this.supported)return;
		dText.frame.styleSheet.insertRule(`#${dText.randomText}_textCanvasContainer canvas{will-change:transform;top:0;left:0;position:absolute;}`,0);
		dText.frame.styleSheet.insertRule(`#${dText.randomText}_textCanvasContainer.moving canvas{transition:transform 500s linear;}`,0);
		dText.frame.styleSheet.insertRule(`#${dText.randomText}_textCanvasContainer{will-change:transform;pointer-events:none;overflow:hidden;}`,0);

		this.container=dText.textCanvasContainer=document.createElement('div');//for text canvas
		this.container.classList.add(`${dText.randomText}_fullfill`);
		this.container.id=`${dText.randomText}_textCanvasContainer`;
		dText.container.appendChild(this.container);
		document.addEventListener('visibilitychange',e=>{
			if(dText.renderMode===1 &&!document.hidden){
				this.resetPos();
			}
		});
	}
	_toggle(s){
		let D=this.dText,T=D.frame.time;
		this.container.classList[s?'add':'remove']('moving');
		for(let i=D.DanmakuText.length,t;i--;){
			if((t=D.DanmakuText[i]).danmaku.mode>=2)continue;
			if(s){requestAnimationFrame(a=>this._move(t,T+500000));}
			else{this._move(t,T);}
		}
	}
	pause(){
		this._toggle(false);
	}
	start(){
		this._toggle(true);
	}
	_move(t,T){
		if(!t.danmaku)return;
		if(T===undefined)T=this.dText.frame.time+500000;
		t._cache.style.transform=`translate3d(${(((this.dText._calcSideDanmakuPosition(t,T,this.dText.width)-t.estimatePadding)*10)|0)/10}px,${t.style.y-t.estimatePadding}px,0)`;
	}
	resetPos(){
		this.pause();
		this.dText.paused||setImmediate(()=>this.start());
	}
	resize(){
		this.resetPos();
	}
	remove(t){
		this.container.removeChild(t._cache);
	}
	enable(){
		this.container.hidden=false;
	}
	disable(){
		this.container.hidden=true;
	}
	newDanmaku(t){
		t._cache.style.transform=`translate3d(${t.style.x-t.estimatePadding}px,${t.style.y-t.estimatePadding}px,0)`;
		this.container.appendChild(t._cache);
		if(t.danmaku.mode<2)requestAnimationFrame(a=>this._move(t));
	}
}


export default TextCanvas;
