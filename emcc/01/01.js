/**
 * 1. 使用emcc命令可以将C/C++文件编译为wasm文件，例如：emcc hello.cc
 * 2. 使用emcc hello.cc 将得到两个文件：a.out.wasm以及a.out.js。其中a.out.wasm为C源文件编译后形成的WebAssembly汇编文件；a.out.js是Emscripten生成的胶水代码，其中包含了Emscripten的运行环境和wasm的封装，导入a.out.js即可自动完成.wasm载入/编译/实例化、运行时初始化等繁杂的工作。
 * 3. 使用-o选项可以指定emcc的输出文件，例如：emcc hello.cc -o hello.js
 * 4. emcc生成的胶水代码不够灵活，只不过用起来简便
 * 5. 生成的js文件也可以直接在Node环境中运行，直接require('hello.js')或者运行node hello.js
 * 6. -o xx.html可以生成html文件，但一般很少用这种方式
 */
function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.onload = resolve;
        script.onerror = reject;
        script.src = url;
        document.body.appendChild(script);
    })
}
async function loadHelloWorld() {
    // 加载a.out.js之后会自动完成wasm的加载及实例化，并且会自动调用main方法
    // await loadScript('a.out.js')
    // 重复加载相同的代码则会导致报错
    await loadScript('hello.js')
}
/**
 * 1. 胶水代码中的instantiateAsync函数用于处理异步实例化wasm，第三个参数为imoprts对象，即wasm需要导入的模块。该函数判断是否支持 WebAssembly.instantiateStreaming方法，如果支持就使用该方法初始化wasm，不支持则使用 WebAssembly.instantiate初始化。
 * 2. 胶水代码中的receiveInstance函数负责将wasm实例中的模块保存到全局变量中以便对外提供访问，比如保存了instance.exports与instance.memory。在wasm中最核心的就是import export memory table等，而到此已经拥有前三个核心部分的对象了。除此之外还会调用一些初始化函数。
 * 3. 胶水代码中的createWasm函数负责创建wasm，也是在该函数中调用了instantiateAsync、receiveInstance等函数。在该函数会调用了getWasmImports函数实例化wasm需要导入的对象。如果定义了Module['instantiateWasm']，将调用Module['instantiateWasm']并传递imports与receiveInstance参数进行自定义初始化，如果未指定则调用默认的初始化。
 * 4. 在Module对象上可以绑定一些钩子函数，但必须在加载胶水代码前绑定！并且Module是全局对象！
 * 5. 自定义实例化虽然麻烦一些，但是更灵活。receiveInstance返回值是instance.exports引用。
 * 6. 默认是通过异步加载并实例化wasm的，如果不是自定义实例化，就需要在wasm初始化完成后的钩子函数中进行wasm操作。所有的钩子函数或事件都是绑定在Module上的，比如onRuntimeInitialized
 */
async function loadHelloWorld2() {
    window.Module = {
        onRuntimeInitialized:function(){
            console.log(Module,Module['_main'](),Module['_dynCall_jiji']);
        },
        instantiateWasm: async function ( imports,receiveInstance) {
            // receiveInstance函数接收instance,module参数，因此需要自己加载wasm文件
            const module=await WebAssembly.compileStreaming(fetch('./hello.wasm'))
            const instance = new WebAssembly.Instance(module,imports)
            const obj = receiveInstance(instance,module)
            console.log(instance, imports,obj)
            obj.main();
            console.log(instance.exports==obj)
        }
    }
    await loadScript('hello.js')
}
/**
 * 1. 事实上Emscripten的诞生早于WebAssembly，在wasm标准出现前的很长一段时间内，Emscripten的编译目标是asm.js。自1.37.3起，Emscripten才开始正式支持wasm。
 * 2. 以asm.js为编译目标时，C/C++代码被编译为.js文件；以wasm为编译目标时，C/C++代码被编译为.wasm文件及对应的.js胶水代码文件。两种编译目标从应用角度来说差别不大--它们使用的内存模型、函数导出规则、js与C调用的方法等都是一致的。
 * 我们在实际使用中遇到的主要区别在于模块加载的同步和异步：当编译目标为asm.js时，由于C/C++代码被完全转换成了asm.js(js子集)，因此可以认为模块是同步加载的；而是wasm为编译目标时，由于wasm的实例化方法本身是异步指令，因此模块加载为异步加载。以asm.js为目标的工程切换至wasm时，容易发生Emscripten运行时未就绪调用了Module功能的问题。
 * 3. 自1.38.1起，Emscripten默认的编译目标切换为wasm。如果仍然要以asm.js为编译目标，只需要在调用emcc时添加-s WASM=0参数。
 * 4. wasm是二进制格式，体积小、执行效率高是其先天优势。在兼容性允许的情况下，应尽量使用wasm作为编译目标。
 * 5. emcc编译C/C++的流程如下：C/C++代码首先通过Clang编译为LLVM字节码，然后根据不同的目标编译为asm.js或wasm。由于内部调用Clang，因此emcc支持绝大多数的Clang编译选项，比如-s OPTIONS=VALUE、-O、-g等。除此之外，为了适应web环境，emcc增加了一些特有的选项，如--pre-js <file>、--post-js <file>等。
 */
async function loadASM(){
    await loadScript('hello.asm.js');
}
async function main() {
    // await loadHelloWorld();
    // await loadHelloWorld2();
    await loadASM();
}
main();