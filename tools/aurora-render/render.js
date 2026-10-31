// offline renderer: draws aurora.glsl at W x H for each time in a loop, writes PNG frames
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const [W,H,out,from,to,fps,loop]=[+process.argv[2],+process.argv[3],process.argv[4],+process.argv[5],+process.argv[6],+(process.argv[7]||30),+(process.argv[8]||12)];
const F=fs.readFileSync(__dirname+'/aurora.glsl','utf8');
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
await p.setContent('<body style="margin:0"><canvas id=c width='+W+' height='+H+'></canvas></body>');
const err=await p.evaluate(({F,W,H})=>{const gl=document.getElementById('c').getContext('webgl',{preserveDrawingBuffer:true});
const sh=(ty,s)=>{const o=gl.createShader(ty);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o};
try{const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,F));gl.linkProgram(pr);gl.useProgram(pr);
const bf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const a=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
gl.uniform2f(gl.getUniformLocation(pr,'res'),W,H);window.draw=(ph)=>{gl.uniform1f(gl.getUniformLocation(pr,'ph'),ph);gl.drawArrays(gl.TRIANGLES,0,3);gl.finish();};}catch(e){return String(e)}return null},{F,W,H});
if(err){console.log(err);process.exit(1);}
const N=Math.round(fps*loop);
for(let i=from;i<Math.min(to,N);i++){await p.evaluate(ph=>draw(ph),i/N);const d=await p.evaluate(()=>document.getElementById('c').toDataURL('image/png'));fs.writeFileSync(`${out}/f${String(i).padStart(4,'0')}.png`,Buffer.from(d.split(',')[1],'base64'));}
await b.close();})();
