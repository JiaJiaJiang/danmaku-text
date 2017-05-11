/*
Copyright luojia@luojia.me
LGPL license
*/
import Mat from '../lib/Mat/Mat.js'
import Template from './textModuleTemplate.js';
const requestIdleCallback=window.requestIdleCallback||setImmediate;

class Text3d extends Template{
	constructor(dText){
		super(dText);
		this.supported=false;
		let c3d=this.c3d=dText.canvas3d=document.createElement('canvas');
		c3d.classList.add(`${dText.randomText}_fullfill`);
		c3d.id=`${dText.randomText}_text3d`;
		dText.context3d=c3d.getContext('webgl')||c3d.getContext('experimental-webgl');//the canvas3d context

		if(!dText.context3d){
			console.warn('text 3d not supported');
			return;
		}
		dText.container.appendChild(c3d);
		const gl=this.gl=dText.context3d,canvas=c3d;
		//init webgl

		//shader
		var shaders={
			danmakuFrag:[gl.FRAGMENT_SHADER,`
				varying lowp vec2 vDanmakuTexCoord;
				uniform sampler2D uSampler;
				void main(void) {
					gl_FragColor = texture2D(uSampler,vDanmakuTexCoord);
				}`
			],
			danmakuVert:[gl.VERTEX_SHADER,`
				attribute vec2 aVertexPosition;
				attribute vec2 aDanmakuTexCoord;
				uniform mat4 u2dCoordinate;
				uniform vec2 uDanmakuPos;
				varying lowp vec2 vDanmakuTexCoord;
				void main(void) {
					gl_Position = u2dCoordinate * vec4(aVertexPosition+uDanmakuPos,0,1);
					vDanmakuTexCoord = aDanmakuTexCoord;
				}`
			],
		}
		function shader(name){
			var s=gl.createShader(shaders[name][0]);
			gl.shaderSource(s,shaders[name][1]);
			gl.compileShader(s);
			if (!gl.getShaderParameter(s,gl.COMPILE_STATUS))
				throw("An error occurred compiling the shaders: " + gl.getShaderInfoLog(s));
			return s;
		}
		var fragmentShader = shader("danmakuFrag");
		var vertexShader = shader("danmakuVert");
		var shaderProgram = this.shaderProgram = gl.createProgram();
		gl.attachShader(shaderProgram,vertexShader);
		gl.attachShader(shaderProgram,fragmentShader);
		gl.linkProgram(shaderProgram);
		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			console.error("Unable to initialize the shader program.");
			return;
		}
		gl.useProgram(shaderProgram);

		//scene
		gl.clearColor(0, 0, 0, 0.0);
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA ,gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

		this.maxTexSize=gl.getParameter(gl.MAX_TEXTURE_SIZE);

		this.uSampler=gl.getUniformLocation(shaderProgram,"uSampler");
		this.u2dCoord=gl.getUniformLocation(shaderProgram,"u2dCoordinate");
		this.uDanmakuPos=gl.getUniformLocation(shaderProgram,"uDanmakuPos");
		this.aVertexPosition=gl.getAttribLocation(shaderProgram,"aVertexPosition");
		this.atextureCoord=gl.getAttribLocation(shaderProgram,"aDanmakuTexCoord");

		gl.enableVertexAttribArray(this.aVertexPosition);
		gl.enableVertexAttribArray(this.atextureCoord);

		this.commonTexCoordBuffer=gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER,this.commonTexCoordBuffer);
		gl.bufferData(gl.ARRAY_BUFFER,commonTextureCoord,gl.STATIC_DRAW);
		gl.vertexAttribPointer(this.atextureCoord,2,gl.FLOAT,false,0,0);

		gl.activeTexture(gl.TEXTURE0);
		gl.uniform1i(this.uSampler,0);

		this.supported=true;
	}
	draw(force){
		const gl=this.gl,l=this.dText.DanmakuText.length;
		for(let i=0,t;i<l;i++){
			t=this.dText.DanmakuText[i];
			if(!t || !t.glDanmaku)continue;
			gl.uniform2f(this.uDanmakuPos,t.style.x-t.estimatePadding,t.style.y-t.estimatePadding);

			gl.bindBuffer(gl.ARRAY_BUFFER,t.verticesBuffer);
			gl.vertexAttribPointer(this.aVertexPosition,2,gl.FLOAT,false,0,0);

			gl.bindTexture(gl.TEXTURE_2D,t.texture);

			gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
		}
		gl.flush();
	}
	clear(){
		this.gl.clear(this.gl.COLOR_BUFFER_BIT);
	}
	deleteTextObject(t){
		const gl=this.gl;
		if(t.texture)gl.deleteTexture(t.texture);
		if(t.verticesBuffer)gl.deleteBuffer(t.verticesBuffer);
		if(t.textureCoordBuffer)gl.deleteBuffer(t.textureCoordBuffer);
	}
	resize(w,h){
		const gl=this.gl,C=this.c3d;
		C.width=this.dText.width;
		C.height=this.dText.height;
		gl.viewport(0,0,C.width,C.height);
		gl.uniformMatrix4fv(this.u2dCoord,false,(new Mat.Identity(4).translate3d(-1,1,0).scale3d(2/C.width,-2/C.height,0)).array);
	}
	enable(){
		this.dText.DanmakuText.forEach(t=>{
			this.newDanmaku(t,false);
		});
		this.dText.useImageBitmap=this.c3d.hidden=false;
		requestAnimationFrame(()=>this.draw());
	}
	disable(){
		this.dText._cleanCache(true);
		this.c3d.hidden=true;
	}
	newDanmaku(t,async=true){
		const gl=this.gl;
		t.glDanmaku=false;
		if(t._cache.height>this.maxTexSize || t._cache.width>this.maxTexSize){//ignore too large danmaku image
			console.warn('Ignore a danmaku width too large size',t.danmaku);
			return;
		}
		let tex;
		if(!(tex=t.texture)){
			tex=t.texture=gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D,tex);
			gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
		}
		if(async){
			requestIdleCallback(()=>{
				gl.bindTexture(gl.TEXTURE_2D,tex);
				gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,t._cache);
				t.glDanmaku=true;
			});
		}else{
			gl.bindTexture(gl.TEXTURE_2D,tex);
			gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,t._cache);
			t.glDanmaku=true;
		}

		//vert
		t.verticesBuffer||(t.verticesBuffer=gl.createBuffer());
		gl.bindBuffer(gl.ARRAY_BUFFER,t.verticesBuffer);
		gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
			0,0,
			t._cache.width,0,
			0,t._cache.height,
			t._cache.width,t._cache.height,
		]), gl.STATIC_DRAW);
	}
}



const commonTextureCoord=new Float32Array([
	0.0,  0.0,
	1.0,  0.0,
	0.0,  1.0,
	1.0,  1.0,
]);


export default Text3d;
