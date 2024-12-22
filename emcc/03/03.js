/**
 * 1. 在C/C++中main函数意味着程序的整个生命周期，随着程序main函数返回而结束，也就是说main函数执行结束程序也就结束了。
 * 2. 在Emscripten下main函数会自动运行，在main函数执行完成之后还可以继续调用main。
 * 3. 如果希望在main执行之后不允许再调用main函数，则可以在编译时指定-s NO_EXIT_RUNTIME=0参数，该参数告诉emscripten不自动调用exit函数销毁emscripten生成的wasm的运行时
 * 4. wasm模块中的方法永远是可以被调用的，此处说的emscripten的生命周期是其生成的代码中也维护着一个运行时，有main函数也有exit函数，exit负责销毁释放资源
 * 5. 如果编译器不生成运行时exit函数，那么就不自动调用exit，main函数就可以一直被调用，如果生成了exit就会在main之后调用exit，然后销毁main函数，也就无法再调用。
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
async function runtimeMain() {
    Module = {
        onRuntimeInitialized: function () {
            console.log(1)
            // main函数可以被多次调用
            Module._main();
            setTimeout(() => {
                // 由于调用了exit函数就不能再调用main了。
                Module._main();
            }, 1000);
        }
    }
    await loadScript('main.js')
}
/**
 * 1. 除了一次性立即退出的程序外，大多数C/C++程序都存在类似下列伪代码的消息循环：
 * int main(){
 *  while(1){
 *      msg_loop();
 *  }
 *  return 0;
 * }
 * 2. 但在网页中的js脚本是单线程运行的，一个带有消息循环的C/C++程序如果不加处理，直接使用emscripten编译后导入网页中运行，消息循环不退出，会阻塞页面程序的运行，导致DOM无法更新，整个页面失去响应。
 * 3. 为此emscripten提供了一组函数用于消息循环的模拟与调度执行。emscripten_set_main_loop()
 * 4. 需要注意的是启用了模拟循环机制，一旦循环执行起来后面的js就无法运行，除非在它执行前通过定时器执行。
 * 5. 使用emscripten提供的消息循环函数对C/C++代码来说是侵入式的，建议尽量避免使用emscripten的消息循环。
 */
async function mainLoop() {
    setTimeout(() => {
        Module._pause_loop();
        setTimeout(() => {
            Module._resume_loop();
            setTimeout(() => {
                Module._cancel_loop();
            }, 3000);
        }, 3000);
    }, 5000);

    await loadScript('main_loop.js')

}
/**
 * 1. 跨平台的C/C++程序通常使用fopen fread fwrite等libc/libcxx提供的同步文件访问函数。在文件系统这一问题上，通常的js程序与C/C++本地程序有巨大的差异，主要体现在：
 * 1.1 运行在浏览器中的js程序无法访问本地文件系统
 * 1.2 在js中，无论是ajax还是fetch，都是异步操作
 * 2. 异步文件系统API是一组声明于emscripten.h中的函数，只能在emscripten环境下使用
 * 3. 在最底层，emscripten提供了三种文件系统，分别为：
 * 3.1 MEMFS：内存文件系统。该系统的数据完全存在于内存中，程序运行时写入的数据在页面刷新或程序重载后将丢失。
 * 3.2 NODEFS: node.s文件系统。该系统可以访问本地文件系统，可以持久化存储，但只能用于node.js环境。本质上就是wasm调用了node.js中的文件操作方法。
 * 3.3 IDBFS: IndexedDB文件系统。该系统基于浏览器的IndexedDB对象，可以持久化存储，但只能用于浏览器环境。
 * 4. emscripten同步文件系统API通过js对象FS封闭了上述三种文件系统，进而供fopen fread fwrite等libc/libcxx文件访问函数调用
 * 5. 从调用语法的角度看，C/C++代码与生成本地代码时无异，但要注意不同的底层文件系统有各自的特性，以及由此引发的业务逻辑差异。
 */
/**
 * 1. 文件导入MEMFS之前，需要将其打包。文件打包可以在emcc命令行中完成，也可以使用单独的文件包工具file_packager.py。
 * 2. 打包时有2种模式：embed以及preload。在embed模式下，文件数据被转换为js代码；在preload模式下，除了生成的.js文件外，还会额外生成同名的.data文件，其中包含了所有文件的二进制数据，生成的.js文件中包含.data文件包下载、装载操作的胶水代码。
 * 3. embed模式需要将数据文本化编码，所产生的文件包体积大于preload模式，因此除非需要打包的文件总数量量非常小，尽可能使用preload模式。
 * 4. 使用emcc命令时，--preload-file参数用于以preload模式打包指定文件或文件夹，相对的，--embed-file参数用于以embed模式打包指定的文件或文件夹。
 * 5. 在emsdk中的file_packager.py可以单独执行文件打包
 * python3 /Users/nick/emsdk/upstream/emscripten/tools/file_packager.py hello.data --preload hello.txt --js-output=hello_data.js
 * 6. 使用外挂的文件包时，编译时需要指定-s FORCE_FILESYSTEM=1参数，强制启用文件系统
 */
async function preloadFS() {
    await loadScript('preload_fs.js');
}
async function helloFS() {
    // 使用了外挂文件系统需要先加载外挂文件脚本用来加载文件
    await loadScript('hello_data.js');
    await loadScript('hello.js');
}
/**
 * 1. 与NODEFS类似，IDBFS的挂载是通过FS.mount方法完成。事实上运行时，IDBFS仍然是使用内存来存储虚拟文件系统，只不过IDBFS可以通过FS.syncfs方法进行内存数据与IndexedDB的双向同步，以达到数据持久化存储的目的。
 * FS.syncfs是异步操作，因此初始化时应该在FS.syncfs回调函数之后对文件进行操作。
 * 2. 在使用IDBFS时要时刻注意文件同步问题，写入或删除文件要及时同步到IndexedDB！
 */
async function idbFS() {
    await loadScript('idb_fs.js')
}
/**
 * 1. emscripten默认的内存容量为16MB，栈容量为5MB
 * 2. 在使用emcc编译时，可以使用TOTAL_MEMORY参数控制内存容量
 * emcc xx.cc -s TOTAL_MEMORY=67108864 -o xx.js
 * 3. 栈容量则可以通过 -s TOTAL_STACK参数设置
 * 4. 栈空间消耗内存，并且在运行时栈空间不可调，实际程序可用的堆空间容量<=内存容量减去栈容量，因此在设置编译参数时，TOTAL_MEMORY必须大于TOTAL_STACK
 * 5. 由于webassembly内存单位为页，每页64KB，因此编译为wasm时，TOTAL_MEMORY必须为64KB的整数倍
 * 6. 除了通过TOTAL_MEMORY参数在编译时设置内存容量外，还可以通过预设的Module对象TOTAL_MEMORY属性值的方法设置内存容量。
 * 7. 在默认设置下，emscripten堆一经初始化容量就固定了，无法再扩容。使用-s ALLOW_MEMORY_GROWTH=1参数允许动态扩容
 * 8. 在可变内存模式下，使用malloc等函数分配内存时，若可用空间不足，将引发emscripten堆扩容。扩容时，内存中原有的数据会被拷入扩容后的内存空间中，因此扩容并不会导致数据丢失或地址变更。
 * 9. 编译为asm.js时，可变内存模式会影响性能。但在wasm中则不会有性能影响，本身wasm就支持内存扩容。
 * 10. 即使采用了内存可变模式，内存容量仍然受32位地址空间的限制。
 * 11. emscripten提供了两种内存分配器：
 * 11.1 dlmalloc默认值。由Doug Lea创建的内存分配器，其变种广泛用于Linux等。
 * 11.2 emmaloc专为emscripten设计的内存分配器。
 * 12. emmalloc的代码体积小于dlmalloc，但是如果程序中频率申请大量的小片内存，使用dlmalloc性能较好。
 * 13. 编译时设置MALLOC参数可以指定内存分配器，例如 emcc xx.cc -s MALLOC="emmalloc" -o xx.js
 * 14. 除非对于代码体积极度敏感的场合，使用默认的dlmalloc内存分配器无疑是更优的选择。
 */
async function memory() {
    Module = {
        onRuntimeInitialized: function () {
            // 编译时指定了内存空间与打印一致
            console.log(Module.HEAP8.length);
        }
    }
    await loadScript('memory.js');
}
/**
 * 1. js对象Module控制了运行时相关的很多行为。例如生命周期函数以及INITIAL_MEMORY等设置。
 * 2. 需要注意的是，如果要在运行时初始内存就需要设置两个关键的参数： -s ALLOW_MEMORY_GROWTH=1 -s IMPORTED_MEMORY=1
 * 一个是允许动态调整内存，一个是允许导入内存。导入内存就需要在env中创建memory实例，如果如果使用了memory实例，其实内存空间也可以不必指定，因为memory实例本身就指定了空间！
 * 3. 目前通过Module设置内存有点傻，设置INITIAL_MEMORY必须开启导入内存，就得自己手动实例化，如果手动实例化真的没有必要设置INITIAL_MEMORY参数。要么就得在编译时指定TOTAL_MEMORY，如果编译时指定又何必运行时设置初始化值呢？只会让你疑惑，因为编译时设置的TOTAL_MEMORY也不是最终的，最终还是取决于运行时指定的！
 * 4. 很多内置方法是挂载在Module身上的，可以自行覆盖重新定义，比如print函数。除此之外，Module对象中提供了Module.arguments、Module.onAbort、Module.noInitialRun等一系列可自定义的对象/方法，具体使用详见Emscripten官方文档https://kripken.github.io/emscripten-site/docs/api_reference/module.html。
 * 5. 在某些情况下，我们希望在emscripten生成的.js胶水代码的前后分别插入一些自定义代码，此时可以使用两个特殊的编译参数：--pre-js 与 --post-js
 * 
 */
async function setupModule() {
    Module = {
        // INITIAL_MEMORY: 655360/5,
        INITIAL_MEMORY:655360*10,
        onRuntimeInitialized: function () {
            console.log(Module.HEAP8.length);
        },
        print:function(){
            console.warn.apply(this,arguments)
        }
    }
    await loadScript('module.js');
}
async function main() {
    // await runtimeMain()
    // await mainLoop();
    // await preloadFS();
    // await helloFS();
    // await idbFS();
    // await memory();
    await setupModule();
}
main()