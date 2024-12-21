/**
 * 1. 一个具备实用功能的WebAssembly模块，必然提供了供外部调用的函数接口。
 * 2. 为了方便函数导出，可以定义一个函数导出宏，该宏需要完成以下功能：
 * 2.1 使用C风格符号修饰。我们知道，由于引入了多态、重载、模板等特性，C++语言环境下的符号修饰策略（既函数、变量在最终编译成果中的名字的生成规则）非常复杂，并且不同的C++编译器有着各自的符号修饰策略，如果不做额外处理，我们在C++中创建函数的时候，很难预知它在最终编译结果中的名字--这与C语言环境完全不同。因此当我们试图将main函数之外的全局函数导出到javascript时，必须强制使用C风格的符号修饰，以保持函数名称在C/C++环境以及Javascript环境中有统一的对应规则。
 * 2.2 避免函数因为缺乏引用而导致在编译时被优化器删除。如果某个导出函数仅供Javascript调用，而在C/C++环境中从未被使用，开启某些优化选项（比如-O2以上）时，函数有可能被编译器优化删除，因此需要提前告知编译器：该函数必须保留，不能删除，不能改名。
 * 2.3 为了保持足够的兼容性，宏需要根据不同的环境--原生NativeCode环境与Emscripten环境、纯C环境与C++环境等自动切换合适的行为。
 * 3. main()作为C/C++程序的主入口，其符号修饰策略是特殊的，因此即使在C++中不作特殊约束，其最终的符号仍然是_main。
 * 4. EMSCRIPTEN_KEEPALIVE宏是emscripten特有的宏，用于告知编译器后续函数在优化时必须保留，并且该函数将被导出至js。
 * 5. 在base.cpp中定义了EM_PORT_API宏，使用该宏定义函数声明的方式如下： EM_PORT_API (int) Func(int param);在emscripten中最终被展开如下：#include <emscripten.h> extern "C" int EMSCRIPTEN_KEEPALIVE Func(int param);
 * 6. 胶水代码中的Module对象已经封闭了C环境导出的函数，封闭方法的名字是下划线_加上C环境的函数名。
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
/**
 * 1. 需要注意的是，js是弱类型语言，在调用函数时，并不要求调用方与被调用方的签名一致，这与C/C++有本质性的不同。
 * 2. 在js环境中，如果给出的参数个数多于函数形参个数，多余的参数被舍弃（从左至右，最新版本的对于多参数进行报错）；如果参数个数少于形参个数，不足的参数自动以undefined填充。
 * 3. 当js传递的参数类型与被调用的函数的参数类型不匹配时会尝试进行转换，就是js中的类型转换。
 */
async function jsCallC() {
    Module = {
        onRuntimeInitialized: function () {
            console.log(Module._show_me_the_answer())
            console.log(Module._add(3, 39))
            // 多余的参数被忽略，但最新版的是直接报错
            // console.log(Module._add(3,39,1))
            // 少的参数用undefined补充，所以导致结果是NaN
            console.log(Module._add(3))
            // 参数类型不正确的会试图进行类型转换
            console.log(Module._add("3", 1))
            console.log(Module._add("a3", 1))
        }
    }
    await loadScript('base.js')
}

/**
 * 1. Emscripten提供了多种在C环境调用js的方法，包括：
 * 1.1 EM_JS / EM_ASM 宏内联js代码
 * 1.2 emscripten_run_script函数
 * 1.3 js函数流入（更准确的描述为：“Implement C API in JavaScript”，既在js中实现C函数API）
 * 2. 在C环境中，我们经常碰到这种情况：模块A调用 了由模块B实现的函数--即在模块A中创建函数声明，在模块B中实现函数体。在Emscripten中，C代码部分是模块A，js代码部分是模块B。
 * 3. 由于C声明的函数是由js实现的，因此在编译时要使用--js-library xx.js指定实现这些函数的js库文件，如果未指定就会出现链接错误。
 * 4. 在js向C提供方法时，在实现的js文件中需要用特定的函数将js方法导入到C中（其实只是为了让编译器知道如何链接该函数）。mergeInto(LibraryManager.library,{}），在第二个参数对象中编写要导入C的方法即可。
 * 5. 在js向C注入方法时，可以在js函数中调用其它全局js函数实现闭包调用。
 * 6. js函数注入的优缺点：
 * 6.1 优点： 使用js函数流入可以保持C代码的纯净--即C代码中不包含任何js的成分
 * 6.2 缺点：该方法需要额外创建一个.js库，维护略为麻烦
 */
async function cCallJs() {
    Module = {
    }
    Module.onRuntimeInitialized = function () {
        Module._print_the_answer();
    }
    await loadScript('capi_js.js')
}
/**
 * 1. 无论编译目标是asm.js还是wasm，C/C++代码眼中的内存空间实际上对应的都是Emscripten提供的ArrayBuffer对象：Module.buffer，C/C++内存地址与Module.buffer数组下标一一对应。
 * 2. ArrayBuffer是js中用于保存二进制数据的一维数据。Module.buffer、C/C++内存、Emscripten堆三者是等价的。
 * 3. C/C++代码能直接通过地址访问的数据全部在内存中（包括运行时堆、运行时栈），而内存对应Module.buffer对象，C/C++代码能直接访问的数据事实上被限制在Module.buffer内部，js环境中的其他对象无法被C/C++直接访问--因此我们称其为单向透明的内存模块。
 * 4. 在当前版本的emscripten中，指针（即内存地址）类型为int32，因此单一模块的最大可用内存范围为2GB-1.未定义的情况下，内存默认容量为16MB，其中栈容量为5MB。
 * 5. js中的ArrayBuffer无法直接访问，必须通过某种类型的TypedArray方可对其进行读写。
 */
function useArrayBuffer() {
    /**
     * 1. 以下创建了一个arrayBuffer并指定其容量为12个字节
     * 2. 通过创建一个Int32Array的typedArray对象可以向buffer中写入int32的数据
     * 3. 实际上ArrayBuffer也有方法将数据以不同typedArray进行读取，可以理解是提供不同数据类型的视图。
     */
    var buf = new ArrayBuffer(12);
    var i32 = new Int32Array(buf);
    i32[0] = 11111;
    i32[1] = 22222;
    i32[2] = 33333;
    console.log(buf);
    console.log(i32)
}
/**
 * 1. Emscripten已经为Module.buffer创建了常用 类型的TypedArray，如下：
 * 对象              TypedArray      对应C数据类型
 * Module.HEAP8     Int8Array           int8
 * Module.HEAP16    Int16Array          int16
 * Module.HEAP32    Int32Array          int32
 * Module.HEAPU8     Uint8Array           uint8
 * Module.HEAPU16    Uint16Array          uint16
 * Module.HEAPU32    Uint32Array          uint32
 * Module.HEAPF32    Float32Array          float
 * Module.HEAPF64    Float642Array          double
 * 2. 在js中访问C/C++中的内存，需要先获取内存地址和偏移量，然后通过Module提供的内存对象读取数据
 */
async function cMemory() {
    Module = {
    }
    Module.onRuntimeInitialized = function () {
        // 首先调用C方法获取int类型的指针
        var intPtr = Module._get_int_ptr();
        // 由于int类型对应Module.HEAP32，所以通过Module.HEAP32读取数据
        // 由于Module.HEAP32每个元素占4字节，因此intPtr需要除以4（即右移2位）方为正确的索引。
        var intValue = Module.HEAP32[intPtr >> 2];
        console.log(intPtr, intValue)
        var doublePtr = Module._get_double_ptr();
        // double类型占8字节因此要除以8，右移3位就是除以8，其实就是2的3次方
        var doubleValue = Module.HEAPF64[doublePtr >> 3];
        console.log(doublePtr, doubleValue)
        Module._print_data();
    }
    await loadScript('memory.js');
}
/**
 * 1. js与C/C++相互调用的时候，参数与返回值究竟是如何传递的？答案是：一切皆为Number。js只有一种数值类型：Number，即64位浮点数。
 * 2. 从语言角度来说，js与C/C++有完全不同的数据体系，Nuber是二者唯一的交集，因此本质上二者互相调用时，都是在交换Number。
 * 3. Number可以精确表达32位以下整型数、32位浮点数、64位浮点数，这涵盖了大多数C语言的基础数据类型--64位整型数除外，这意味着js与C相互操作时，不能使用64位整型数作为参数或返回值
 * 4. Number从js传入C/C++有两种途径：
 * 4.1 js调用了带参数的C导出函数，Number通过参数传入
 * 4.2 C调用了由js实现的函数，Number通过注入函数的返回值传入
 * 由于C/C++是强类型语言，因此来自js的number传入时，会发生隐式类型转换。
 * 5. 为什么除64位整型外的简单数值类型转换为Number是无损的呢？因为js中的Number不支持64位整型，除非使用bigint类型。
 * 6. 需要在js与C/C++之间交换大块的数据时，直接使用参数传递数据显然不可行，此时可以通过内存来交换数据。
 * 7. 注意在C/C++中创建的内存要进行释放！
 * 8. 由于js中的内存是ArrayBuffer，其是一个定长的内存空间，所以释放只是标记某些位置的内存可以重复利用，并不会从arrayBuffer中删除掉这些数据，如果访问的是被标记为释放的内存得到的数据就可能是垃圾值，这也就是为什么分配内存时最好进行初始化！
 * 9. Module.HEAP32等对象的名称虽然称为“堆”，但事实上它指的是C/C++环境的整个内存空间，因此位于C/C++栈上的数据也可以通过Module.HEAP32等对象来访问。但书中的描述并不是很准确，栈中的内存js并不能获取！只是在调用js中复制了栈中的值给了js而已，这些拷贝的值并不是通过Module.buffer内存空间获取的！ 
 * 10. 有时候js需要将大块的数据送入C/C++环境，而C/C++无法预知数据块的大小，此时可以在js中分配内存并装入数据，然后将数据指针及长度传入，调用C函数进行处理。js可以通过Module._malloc与Module._free实现类型C/C++中的内存申请与释放。
 * 11. 当需要向js导出alloc与free方法时，构建命令需要通过参数-s 'EXPORTED_FUNCTIONS=["_malloc","_free"]'导出
 * 12. 字符串是极为常用的数据类型，然后C/C++中的字符串表达方式（0值标志结尾）与js完全不兼容；幸运的是，Emscripten为我们提供了一组辅助函数用于二者的转换。
 * 12.1 Pointer_stringify()已经过时了，使用UTF8ToString方法可以将C/C++的字符串转换为js字符串。
 * 13. 有很多胶水代码需要编译时导出才能正常使用，比如malloc以及UTF8ToString等，都需要EXPORTED_FUNCTIONS参数导出
 */
async function exchangeData() {
    Module = {
        onRuntimeInitialized: function () {
            // 以下c方法接收int类型参数，js传递的任何类型都会被转为number类型，而c又会对数据转换成int类型
            Module._print_int(123);
            Module._print_int(123.456);
            // 注意undefined事实会转换为NaN类型，而NaN转int类型只能是0
            Module._print_int();
            Module._print_int(NaN);
            // 并不意外布尔值对应的是0 1
            Module._print_int(false);
            Module._print_int(true);
            // 需要注意的是float与double类型的精度不同，js中浮点数都是f64，但由于C中指定了float与double因此会转换成对应的类型
            Module._print_float(2000000.03125);
            Module._print_double(2000000.03125);

            // 
            var ptr = Module._fibonacci(10);
            // 计算好实际的指针位置使用时更高效，就不需要每次将地址进行偏移了
            var startPtr = ptr >> 2;
            console.log('ptr: ', ptr);
            for (var i = 0; i < 10; i++) {
                console.log(`i: ${Module.HEAP32[(ptr >> 2) + i]} == ${Module.HEAP32[startPtr + i]}`)
            }
            // 释放内存
            Module._free_buf();

            (function () {
                // 通过js申请一段内存，并向该内存写入一些数值，然后将内存地址与长度传递给C函数，由C函数计算这些数值的和
                // 需要存储10个int32
                var count = 10;
                // 时刻要注意内存是按字节计算的，一个int32是4个字节，申请内存的时候要计算好字节
                var ptr = Module._malloc(4 * count);
                var total = 0;
                for (var i = 0; i < 10; i++) {
                    Module.HEAP32[ptr / 4 + i] = i + 1;
                    total += i + 1;
                }
                console.log(`js total: ${total} c total: ${Module._sum(ptr, count)}`)
                Module._free(ptr);
                // 释放之后继续访问之前内存地址的数据可见数据还在，但是以后新申请的内存就有可能使用到已释放的内存空间，所以不要再去使用被释放的内存空间，有可能得到垃圾值！
                console.log(Module.HEAP32[ptr / 4])
            })();
            (function () {
                // char * 是指针，所以js得到的也就是个指针，如果能返回指针与长度其实自己也可以从buffer中读取数据并转换为字符串的
                // 但胶水代码知道字符串是以什么结尾的，所以只需要给它字符串指针的起始值，它会像C/C++一样去读取字节走到遇到0值结尾
                var ptr = Module._get_string();
                console.log(ptr, Module.UTF8ToString(ptr))
                // 既然c可以将字符串写入内存并由js读取，那么js也可以向内存写入字符串由c读取了
                var ptr2 = Module.allocateUTF8("你好，js");
                Module._print_string(ptr2);
                Module._free(ptr2);
            })();

        }
    }
    await loadScript('exchange_data.js');
}
/**
 * 1. 很多编译器支持在C/C++代码直接嵌入汇编代码，Emscripten采用类似的方式，提供了一组以EM_ASM为前缀的宏，用于以内联的方式在C/C++代码中直接嵌入js代码。
 * 2. EM_ASM使用很简单，只需要将要执行的js代码置于参数中，例如：EM_ASM(console.log('你好,js'));
 * 3. EM_ASM 支持多行语句，但多行时每行必须以;号分隔
 * 4. EM_ASM_支持输入数值类型的可变参数，同时返回整数类型的结果。EM_ASM_宏嵌入的js代码必须放到{}包围的代码块中（以区隔代码与参数），且至少必须含有一个输入参数。嵌入的js代码通过$n访问第n+1个参数。
 */
async function EM_ASM() {
    Module = {
        onRuntimeInitialized: function () {

        }
    }
    await loadScript('em_asm.js');
}
/**
 * 1. js调用C/C++时只能使用Number作为参数，因此如果参数是字符串、数组等非Number类型，则需要拆分为以下步骤：
 * 1.1 使用Module._malloc在堆中分配内存，获取指针地址
 * 1.2 将字符串/数组数据拷入内存指针位置
 * 1.3 将指针作为参数，调用C/C++函数进行处理
 * 1.4 使用Module._free释放指针
 * 2. 当调用过程相当繁琐，尤其当非Number参数个数较多时，js侧的调用代码会急剧膨胀。为了简化调用过程，Emscripten提供了ccall/cwrap封装函数。
 * 3. Module.ccall(ident,returnType,argTypes,args)
 * 3.1 ident: C导出函数的函数名（不包含下划线_前缀）
 * 3.2 returnType: C导出函数的返回值类型，可以为boolean number string null  
 * 3.3 argTypes: C导出函数的参数类型的数组。参数类型可以为 number string array
 * 3.4 args: 参数数组
 * 4. 其实ccall函数定义的数据类型是为了方便做类型转换，因为声明和返回类型与参数类型，那么调用ccall传递的参数它就会进行转换和检查，最终帮我们去调用方法
 * 5. ccall的优势在于可以直接命令与征服和字符串Uint8Array Int8Array作为参数
 */
async function cCall() {
    Module = {
        onRuntimeInitialized: function () {
            var res1 = Module.ccall('add', 'number', ['number', 'number'], [13.0, 22]);
            // 使用ccall调用与直接调用其实是等价的
            console.log(`res1: ${res1} == ${Module._add(13.0, 22)}`);
            // 使用ccall调用需要传递或返回字符串类型的方法就简单了，不需要自己再手动处理指针和内存问题了
            Module.ccall('print_string', 'null', ['string'], ['hello world']);
            (function () {
                var count = 10;
                var buf = new ArrayBuffer(4 * 10);
                var i32 = new Int32Array(buf);
                var i8 = new Uint8Array(buf);
                for (var i = 0; i < count; i++) {
                    i32[i] = i + 1;
                }
                // 指针类型用数组就可以了
                var res = Module.ccall('sum', 'number', ['array', 'number'], [i8, count])
                console.log(res)
            })();
            console.log(111, Module.ccall('get_string', 'string'));

        }
    }
    await loadScript('call_wrap.js')
}
/**
 * 1. ccall虽然封装了字符串等数据类型，但调用时仍然需要填入参数类型数组、参数列表等，为此cwrap进行了进一步封闭：var func = Module.cwrap(ident, returnType,argTypes);
 * 1.1 ident: C导出函数的函数包（不包含下划线_前缀）
 * 1.2 returnType: C导出函数的返回值类型，可以为boolean number string null
 * 1.3 argTypes: C导出函数的参数类型的数组。参数类型可以为number string array
 * 2. ccall/cwrap潜在风险，虽然ccall/cwrap可以简化字符串参数的交换，但这种便利性是有代价的：当输入参数类型为string/array时，ccall/cwrap在C环境的栈上分配了相应的空间，并将数据拷入了其中，然后调用相应的导出函数。
 * 相对于堆来说，栈空间是很稀缺的资源，因此使用ccall/cwrap时需要格外注意传入的字符串/数组的大小，避免爆栈！！！
 */
async function cwrap() {
    Module = {
        onRuntimeInitialized: function () {
            // 其本质就是返回了一个可以重复调用的函数
            var cAdd=Module.cwrap('add','number',['number','number']);
            console.log(cAdd(1,2));
            var cPrintString = Module.cwrap('print_string','null',['string']);
            cPrintString("哈哈");
        }
    }
    await loadScript('call_wrap.js');
}
async function main() {
    // await jsCallC();
    // await cCallJs();
    // useArrayBuffer();
    // await cMemory();
    // await exchangeData();
    // await EM_ASM();
    // await cCall();
    await cwrap();
}
main();