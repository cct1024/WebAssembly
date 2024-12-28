/**
 * 1. 大体上，消息循环的作用可以归结为：
 * 1.1 保持程序处于活动状态
 * 1.2 解析并处理各种消息（输入事件、定时事件等）
 * emscript环境下，运行时默认不随main函数退出而退出，Module在网页关闭前一直可用，因此无需emscripten_set_main_loop来保持程序处于活动状态
 * 2. em_callback_func的定义 typedef void(*em_callback_func)(void)，消息回调函数没有参数，导致emscripten内建的消息循环不能携带消息信息，它并不具备事件分发及处理功能，
 * 在大多数情况下只起到循环定时器的作用，如果需要完整的基于事件驱动的模块，仍然需要提供额外的事件入口。
 * 3. 大多数操作系统级消息循环都是围绕着特定的消息体展开的，跨平台编程时，将这些与操作系统紧密相关的部分从核心逻辑代码中分离出去是通行的做法。
 * 4. js本身是事件驱动型的语言，因此对于仅由事件驱动而无需定时执行的C/C++模块来说，只要在js中特定事件发生时调用模块提供的对应事件处理函数即可。
 * 5. 浏览器的重绘帧率与显示设备的重绘帧率是同步对齐的，
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
async function event_loop() {
    function setp_run() {
        Module._setp();
        window.requestAnimationFrame(setp_run);
    }
    Module = {
        onRuntimeInitialized: function () {
            window.requestAnimationFrame(setp_run);
        }
    }
    await loadScript('loop.js')
}
/**
 * 1. 当目标指令储为x86/x64时，未对齐的内存读写不会导致错误的结果；而在emscripten环境下，编译目标为asm.js与wasm时，情况各有不同。
 * 2. 未对齐的含义是：欲访问的内存地址不是欲访问的数据类型大小的整数倍。 
 * 3. 对C语言来说，malloc函数返回的地址可以确保与所有基本数据类型对齐
 * 4. 地址未对齐时，wasm指令的执行性能会下降；当需要通过内存在C/C++与js之间传递大量数据时，仍然绕不过内存的typedArray视图
 * 5. 大多数未对齐的内存操作都源自强制变更指针类型，比如例子中将char *类型变更为ST*类型，然而这种用法很难长度避免，比如序列化和反序列化、使用缓冲小孩子存储多种类型的数据等。
 * 当混用缓冲区时，应仔细设计存储结构，使其每种类型的数据均对齐到最大长度的数据类型--比如某个缓冲区中需要同时存储字符串和double，那么字符串长度应向上对齐到8字节，以保证对其中的所有数据访问都是对齐的。
 * 6. 在默认编译选项下，未对齐的内存操作引发的数据错误是静默的，难以排查错误。使用SAFE_HEAP=1选项进行编译可以检查未对齐的内存操作。
 * 使用该选项后，运行中未对齐的内存读写时，会抛出异常。
 * 7. SAFE_HEAP模式对性能影响很大，应仅在测试时使用。
 */
async function align_memory() {
    await loadScript('asm.js')
}
/**
 * 1. 在emscripten中使用embind和WebIDL binder都可以将C++对象导出至js，但是为了更好的跨平台使用C接口对外导出更好
 * 2. 由于内存模型的差异，C++中的对象和js中的对象结构完全不同，Demo_New返回的是新建的Hello对象在Module中堆中的地址，而非js对象。
 * 这种方法本质上是将C++对象的地址用作js和C++通信的桥梁。
 */
async function bind() {
    Module = {
        onRuntimeInitialized: function () {
            var obj = Module._Demo_New();
            console.log(obj)
            console.log(Module._Demo_Sum(obj, 1, 2))
            console.log(Module._Demo_GetID(obj))
            console.log(Module._Demo_Delete(obj))
        }
    }
    await loadScript('cplus.js')
}
/**
 * 1. C++没有GC机制，当C++对象被导出到js环境后，必须使用某种方法进行对象生命周期管理，以长度杜绝埋指针、内存泄漏，引用计数无疑是最常用的方法。
 * 2. 对象生命周期管理需要解决的问题是：当一个对象可能在多个地方被引用时，如何决定何时将其销毁。引用计数法解决这一问题的途径非常简单：
 * 2.1 每个对象处事一个初始值为0的引用计数；
 * 2.2 对象的每个使用者，在获取一个对象的引用时，将其引用计数加1；
 * 2.3 对象的使用者使用完该对象后，并不直接销毁它，而是将引用计数减1；当引用计数降为0时，说明对象已经没有任何使用者持有该对象的引用，可以将其安全的销毁。
 * 3. C++中一般通过在基类中添加AddRef和Release成员函数来实现引用计数的境减1
 * 4. AddRef/Release的使用一般遵循以下规则：
 * 4.1 当对象的引用从一个内存位置拷贝到另一个内存位置的时候，应该调用AddRef；当一个内存位置所指向的内存引用不再使用时，应该调用Release并将该内存位置设为null;
 * 4.2 如果一个内存位置之前保存了一个非空对象的引用，在向其中写入另一个非空对象的引用时，应该先调用A对象的Release，以通知A对象不再被使用，然后再调用B对象的AddRef；
 * 4.3 多个内存位置之间的对象引用的关系有特殊约定时，可以省略多余的AddRef和Release
 * 	CRefCount* obj = new CRefCount();

    obj->AddRef();
    //do sth. with obj:
    Func(obj);
    obj->Release();
	
    SAFE_RELEASE(obj);
    void Func(CRefCount* obj) {
    if (!obj) return;

    obj->AddRef();
    CRefCount* temp = obj;
    //do sth. with temp:
    //...
    SAFE_RELEASE(temp);
}
Func中没必要进行AddRef和Release，因为局部变量生命周期与函数一样长。
* 5. 引用计数增减规则则可以简化为：
* 5.1 对于传入的对象，如果将其保存到了其他的位置，调用AddRef，否则可以不调用
* 5.2 对于传出的对象，无论是否通过返回值传出，还是通过指针参数传出，都要调用AddRef
* 5.3 对于传入/传出的对象（即使用指针引用参数，在函数内部更改了引用参数的情况），先Release，更改后AddRef
* 5.4 不清楚的情况下，一律加上AddRef/Release 
* 1~3条情况： 
void Func(CRefCount* obj) {
    //do sth. with obj:
    //...
}
    第2条情况： 使用返回值传出对象了
    CRefCount* g_obj = new CRefCount();
CRefCount* GetGlobalObj() {
    g_obj->AddRef();
    return g_obj;
} 
    第3条情况：改变引用指针了，先释放原有指针，再添加新指针引用计数然后更新指针指向新对象
    CRefCount* g_obj = new CRefCount();
void UpdateObj(CRefCount*& obj) {
    SAFE_RELEASE(obj);
    g_obj->AddRef();
    obj = g_obj;
}
 */
async function ref() {
    Module={
        onRuntimeInitialized:function(){
            // 实例化时引用一次，额外调用两次引用，一次relase，最终计数为2
            var rect = Module._NewRect();
            Module._addRef(rect);
            Module._addRef(rect);
            console.log(rect,Module._release(rect))
            var p = Module._NewDemo();
            console.log(p,Module._release(p))
            Module._say(rect);
            Module._say(p);
        }
    }
    await loadScript('ref.js');
}
/**
 * 1. 无论从内存模型的角度，还是从运行模型的角度，C原生代码都无法直接访问js中的对象。为此，我们需要提供一种途径，让C环境可以识别不同的js对象，最容易想到的，就是使用对象/ID表，该方法的核心是：
 * 1.1 为每个将要被注入C环境的js对象分配一个不重复的整数ID，并将该对象/ID的关系记录在一张表中
 * 1.2 将对象的ID传入C环境，C环境使用该整数ID指代实际的js对象
 * 1.3 C环境中的代码通过注入函数操作某个对象时，注入函数通过ID反查实际的js对象并操作它。
 * 2. 从wasm原生层面来说，wasm可以调用js函数，通过import或者通过table都可以。但是table只有一个，且table表中要么是wasm函数要么是js函数。在原生wasm中，可以通过import一个特殊的函数代理调用不同的js对象以及方法。
 */
async function importJS(){
    var table = {};
    var index = 0;
    function Shape(){
        this.name = "shape";
        this.id=index++;
        table[this.id]=this;
        this.say=function(){
            console.log(`this.name: ${this.name} id: ${this.id}`)
        }
    }
    function call_shape(id,fn){
        console.log(id,fn,table)
        if(!table[id]){
            return;
        }
        if(table[id][fn]){
            table[id][fn]();
        }
    }
    Module = {
        Shape:Shape,
        call_shape,
        onRuntimeInitialized:function(){
            const obj = Module._CreateShape();
            console.log(1,obj)
            Module._call_js_shape(obj,"say");
        }
    }
    await loadScript('import.js')
}
/**
 * 1. wasm原生支持int64位整型数算术运算，但js只有一种数值类型number(等同于c中的double),js本质上无法直接表达64位整型数。
 * 2. wasm导出函数不能使用64位整型数作为参数或返回值，一旦js调用参数或返回值类型为64位整型数，将抛出typeerror。
 * 3. 由于该限制的存在，emscripten做了如下妥协：
 * 3.1 当导出函数的某个参数为int64时，将其折分为低32位、高32位两个参数进行传送
 * 3.2 当导出函数的返回值为int64时，在js中仅能接收其低32位
 * 4. 注入函数包含int64也按上述规则处理 
 * C函数定义如下：int64_t func(int64_t a, int64_t b)
 * 导出到js后变为：int32_t func(int32_t a_lo, int32_t a_hi, int32_t b_lo, int32_t b_hi)
 */
/**
 * 1. 忘掉文件系统，NODEFS只能在nodejs中使用，MEMFS/IDBFS都需要占用内存来模拟文件系统。内存是非常珍贵的硬件资源，IOS设备的内存普遍不超过4GB，用内存模拟文件系统不论从哪个角度来说都是非常奢侈的行为。
 * 2. 另外，虚拟文件系统的初始化所消耗的时间也是一个需要考量的因此，体积巨大的打包文件系统下载消耗较长的时间，这对网页应用都很不利。
 * 3. 如果真的需要使用，需要特别留意32位的内存空间、低速的网络IO操作限制等。
 */
async function main() {
    // await event_loop();
    // await align_memory();
    // await bind();
    // await ref();
    await importJS();
}
main()