/**
 * 1. WebAssembly.Module对象包含已经由浏览器编译的无状态的WebAssembly代码，可以高效地与Worker共享和多次实例化
 * 2. WebAssembly.Module.customSections(mod,sectionName)返回模块中具有给定字符串名称的所有自定义部分的内容副本
 * 3. WebAssembly.Module.exports(mod)返回一个数组，其中包含所有声明的导出的描述
 * 4. WebAssembly.Module.imports(mod)返回一个数组，其中包含所有导出的导入的描述
 */
async function moduleWorker() {
    const mod = new WebAssembly.Module(await fetch('base-module.wasm').then(res => res.arrayBuffer()))
    console.log(mod)
    const worker = new Worker('wasm-worker.js');
    worker.postMessage(mod);
    const obj = await WebAssembly.instantiate(mod, {
        imports: {
            import_func(a) {
                console.log(a)
            }
        }
    })
    console.log(obj)
    console.log(WebAssembly.Module.customSections(mod, "a"))
    console.log(WebAssembly.Module.exports(mod))
    console.log(WebAssembly.Module.imports(mod))
}
/**
 * 1. WebAssembly.Instance对象本身是有状态的，是WebAssembly.Module的一个可执行实例。Instance对象包含所有的WebAssembly导出函数，允许从Javascript调用WebAssembly代码。
 * 2. WebAssembly.Instance.exports返回一个包含此WebAssembly模块实例所导出的全部成员对象，以便js访问和使用这些成员，这个对象是只读的。
 */
async function wasmInstance() {
    const mod = await WebAssembly.compileStreaming(fetch('simaple-module.wasm'))
    const obj = new WebAssembly.Instance(mod)
    console.log(obj, obj.exports,obj.exports.getInt())
}
function main() {
    moduleWorker();
    wasmInstance();
}
main();