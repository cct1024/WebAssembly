/**
 * 1. WebAssembly.Module对象包含已经由浏览器编译的无状态的WebAssembly代码，可以高效地与Worker共享和多次实例化
 * 2. WebAssembly.Module.customSections(mod,sectionName)返回模块中具有给定字符串名称的所有自定义部分的内容副本
 * 3. WebAssembly.Module.exports(mod)返回一个数组，其中包含所有声明的导出的描述
 * 4. WebAssembly.Module.imports(mod)返回一个数组，其中包含所有导出的导入的描述
 */
async function moduleWorker() {
    const mod = new WebAssembly.Module( await fetch('base-module.wasm').then(res=>res.arrayBuffer()))
    console.log(mod)
    const worker = new Worker('wasm-worker.js');
    worker.postMessage(mod);
    const obj = await WebAssembly.instantiate(mod,{
        imports:{
            import_func(a){
                console.log(a)
            }
        }
    })
    console.log(obj)
    console.log(WebAssembly.Module.customSections(mod,"a"))
    console.log(WebAssembly.Module.exports(mod))
    console.log(WebAssembly.Module.imports(mod))
}

function main() {
    moduleWorker();
}
main();