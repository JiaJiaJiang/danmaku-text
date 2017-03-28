/*
Copyright luojia@luojia.me
LGPL license
*/
import Mat from '../lib/Mat/Mat.js'


class Text3d{
	constructor(dText){
		this.dText=dText;
		this.supported=false;
		if(!dText.context3d){
			console.warn('text 3d not supported');
			return;
		}
		this.supported=true;
		const gl=this.gl=dText.context3d,canvas=dText.canvas3d;
		//init webgl

		//shader
		var shaders={
		danmakuFrag:[gl.FRAGMENT_SHADER,`
			varying lowp vec2 vDanmakuTexCoord;
			uniform sampler2D uSampler;

			void main(void) {
				gl_FragColor = texture2D(uSampler, vec2(vDanmakuTexCoord.s, vDanmakuTexCoord.t));
			}`],
		danmakuVert:[gl.VERTEX_SHADER,`
			attribute vec2 aVertexPosition;
			attribute vec2 aDanmakuTexCoord;

			uniform mat4 u2dCoordinate;
			uniform vec2 uDanmakuPos;

			varying lowp vec2 vDanmakuTexCoord;

			void main(void) {
				gl_Position = u2dCoordinate * vec4(aVertexPosition+uDanmakuPos,0,1);
				vDanmakuTexCoord = aDanmakuTexCoord;
			}`],
		}
		function shader(name){
			var s=gl.createShader(shaders[name][0]);
			gl.shaderSource(s,shaders[name][1]);
			gl.compileShader(s);
			if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {	
				throw("An error occurred compiling the shaders: " + gl.getShaderInfoLog(s));	
			}
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
		}
		gl.useProgram(shaderProgram);

		//scene
		gl.clearColor(0, 0, 0, 0.0);
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

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
		gl.vertexAttribPointer(this.aVertexPosition,2,gl.FLOAT,false,0,0);

		gl.activeTexture(gl.TEXTURE0);
		gl.uniform1i(this.uSampler,0);
	}
	draw(force){
		const gl=this.gl,l=this.dText.DanmakuText.length;
		for(let i=0,t;i<l;i++){
			t=this.dText.DanmakuText[i];
			if(!t.glDanmaku)continue;
			gl.uniform2f(this.uDanmakuPos,t.style.x-t.estimatePadding,t.style.y-t.estimatePadding);

			gl.bindBuffer(gl.ARRAY_BUFFER,t.verticesBuffer);
			gl.vertexAttribPointer(this.aVertexPosition,2,gl.FLOAT,false,0,0);

			gl.bindTexture(gl.TEXTURE_2D, t.texture);

			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}
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
		if(!this.supported)return;
		const gl=this.gl,canvas=this.dText.canvas3d;
		gl.viewport(0,0,canvas.width,canvas.height);
		//to 2d canvas
		gl.uniformMatrix4fv(this.u2dCoord,false,Mat.Identity(4).translate3d(-1,1,0).scale3d(2/canvas.width,-2/canvas.height,0));
	}
	disable(){
		this.dText.canvas3d.hidden=true;
	}
	newDanmaku(t){
		const gl=this.gl;
		if(t._cache.height>this.maxTexSize || t._cache.width>this.maxTexSize){//ignore too large danmaku image
			t.glDanmaku=false;
			console.warn('Ignore a danmaku width too large size',t.danmaku);
			return;
		}
		let tex=t.texture||(t.texture=gl.createTexture());
		t.glDanmaku=true;
		gl.bindTexture(gl.TEXTURE_2D,tex);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,t._cache);

		//vert
		t.verticesBuffer||(t.verticesBuffer=gl.createBuffer());
		gl.bindBuffer(gl.ARRAY_BUFFER,t.verticesBuffer);
		gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
			0,0,
			t._cache.width,0,
			0,t._cache.height,
			t._cache.width,t._cache.height,
		]), gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER,null);
	}
}

const commonTextureCoord=new Float32Array([
	0.0,  0.0,
	1.0,  0.0,
	0.0,  1.0,
	1.0,  1.0,
]);

export default Text3d;
