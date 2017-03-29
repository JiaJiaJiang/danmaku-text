/*
Copyright luojia@luojia.me
LGPL license
*/

class TextCanvas{
	constructor(dText){
		this.dText=dText;
		this.supported=dText.text2d.supported;
		document.styleSheets[0].insertRule(`.${dText.randomText}_fullfill{top:0;left:0;width:100%;height:100%;position:absolute;}`,0);
		document.styleSheets[0].insertRule(`#${dText.randomText}_textCanvasContainer canvas{top:0;left:0;position:absolute;}`,0);
		document.styleSheets[0].insertRule(`#${dText.randomText}_textCanvasContainer{pointer-events:none;transform:translateZ(0);overflow:hidden;}`,0);

		dText.textCanvasContainer=document.createElement('div');//for text canvas
		dText.textCanvasContainer.classList.add(`${dText.randomText}_fullfill`);
		dText.textCanvasContainer.id=`${dText.randomText}_textCanvasContainer`;
		dText.container.appendChild(dText.textCanvasContainer);
	}
	draw(force){
		const gl=this.gl,l=this.dText.DanmakuText.length;
		for(let i=0,t;i<l;i++){
			t=this.dText.DanmakuText[i];
			t._cache.style.transform=`translate3d(${(((t.style.x-t.estimatePadding)*10)|0)/10}px,${t.style.y-t.estimatePadding}px,0)`;
		}
	}
	clear(){}
	remove(t){
		this.dText.textCanvasContainer.removeChild(t._cache);
	}
	enable(){
		this.dText.textCanvasContainer.hidden=false;
	}
	disable(){
		this.dText.textCanvasContainer.hidden=true;
	}
	newDanmaku(t){
		t._cache.style.transform=`translate3d(${(((t.style.x-t.estimatePadding)*10)|0)/10}px,${t.style.y-t.estimatePadding}px,0)`;
		this.dText.textCanvasContainer.appendChild(t._cache);
	}
}
export default TextCanvas;
