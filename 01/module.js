/**
 * 1. 模块：表示一个已经被浏览器编译为可执行机器码的WebAssembly二进制代码。一个模块是无状态的，并且像一个二进制大对象一样在Window和Worker之间共享。一个模块能够像一个ES的模块一样声明导入和导出。
 * 2. 内存： 一个可变长的ArrayBuffer。本质上是连续的字节数组，WebAssembly的低级内存存取指令可以对它进行读写操作。
 * 3. 表格： 一个可变长的类型化数组。不及格中的项存储了不能作为原始字节存储在内存里的对象的引用（为了安全和可移植性的原因）。
 * 4. 实例： 一个模块及其在运行时使用的所有状态，包括内存、表格和一系列导入值。一个实例就像一个已经被加载到一个拥有一组特定导入的特定的全局变量的ES模块。
 */

/**
 * 1. wasm有一个基于S-表达式的文本形式，设计为在文本编辑器，浏览器开发工具等中暴露的一个中间形式。
 * 2. 文本格式通常被保存为.wat扩展名；有时.wast也被使用，它是说文件包含了额外的测试命令（断言等）并且它们不需要转换到.wasm中。
 * 3. S-表达式是一个非常古老和非常简单的用来表示树的文本格式。因此，我们可以把一个模块想象为一棵由描述了模块结构和代码的节点组成的树。不过，与一门编程语言的抽象语法树不同的是，WASM的树是相当平的，也就是大部分包含了指令列表。
 * 4. 树上的每个一个节点都有一对括号()包围，括号内的第一个标签告诉你该节点的类型，其后跟随的是由空格分隔的属性或孩子节点列表。
 * 5. S-表达式如下：(module (memory 1) (func))。
 *  这条表达式，表示一顶根节点为模块(module)的树，该树有两个孩子节点，分别是（memory 1)节点与(func)节点。
 */
/**
 * 1. wat2wasm xx.wat 将wat编译为wasm
 * 2. watwwasm xx.wat -v 查看wasm二进制
 * 3. 空的module也是合法的，例如：(module)
 */
function loadEmptyModule() {
    WebAssembly.compileStreaming(fetch('./empty-module.wasm')).then(mod => {
        console.log(mod)
    })
}
/**
 * 1. 函数表达式格式为：(func <signature> <locals> <body>)
 * 1.1 签名：声明函数需要的参数以及函数的返回值
 * 1.2 局部变量：像js中的变量，但是显式的声明了类型
 * 1.3 函数体：是一个低级指令的线性列表
 * 2. 签名是由一系列参数类型声明，以及其后面的返回值类型声明列表组成。
 * 2.1 没有(result) 意味着函数不返回任何东西
 * 2.2 在当前版本中，最多拥有一个返回类型，但是以后会放开这个限制到做生意数量。
 * 3. 每一个参数都有一个显式声明的类型，wasm当前有四个可用类型：
 * 3.1 i32: 32位整数
 * 3.2 i64: 64位整数
 * 3.3 f32: 32位浮点数
 * 3.4 f64  64位浮点数
 * 4. 参数格式为(param <类型>)，返回值类型为(result <类型>)。
 * 5. 示例： (func (param i32) (param i32) (result f64))，该示例声明了一个接收2个i32参数并返回f64的函数。
 * 6. 在签名的后面是带有类型的局部变量，格式为（local <类型>）。函数调用可以通过参数实参值对局部变量进行初始化。
 * 局部变量和参数能够被函数体使用local.get和local.set指令进行读写。
 * local.get/local.set指令使用数字索引来指向将被存取的条目：按照他们的声明顺序，参数在前，局部变量在后。
 * 7. 示例：(func (param i32) (param i32) (local f64)
 *  local.get 0
 *  local.get 1
 *  local.get 2
 * )
 * 0 1 2分别代表两个参数和一个局部变量，数字索引太容易让人混淆，因此也可以使用别名的方式来访问它们，方法就是在类型声明的前面添加一个$作为前缀的名字。
 * 例如：(func (param $a i32) (param $b i32) (local $c f64))
 */
function loadFunctionModule() {
    WebAssembly.compileStreaming(fetch('./function-module.wasm')).then(mod => {
        console.log(mod)
        const obj = new WebAssembly.Instance(mod);
        console.log(obj,obj.exports.add(1,2))
    })
}
/**
 * 1. 虽然浏览器把wasm编译为某种更高效的东西，但是，wasm的执行是以栈式机器定义的。也就是说，其基本理念是每种类型的指令都是在栈上执行数值的入栈出栈操作。
 * 例如，local.get被定义把它读到的局部变量值压入栈上，然后i32.add从栈上读取两个i32类型值（它的含义是把前面压入栈上的两个值取出来）计算它们的和（以2^32求模），最后把结果压入栈上。
 * 当函数被调用的时候，它从一个空栈开始的。随着函数体指令的执行，栈会逐步填满和清空。
 * 2. wasm验证规则确定栈准确匹配：如果声明了(result i32)，那么最终栈上必须包含一个i32类型值。如果没有result类型，那么栈必须是空的。
 * 3. wasm函数必须通过模块里面的export 语句显式导出才能被js调用。
 * 4. 像局部变量一样，函数默认也是通过索引来区分的，但是为了方便，可以给它们起个名字。
 * 5. 导出函数声明表达式： (export <name> (func $name))
 * 6. 在同一模块里的函数调用其他函数成员，为函数给定一个索引或名字，call指令可以调用它。
 * 7. 函数也可以直接声明为导出函数，而不先定义为模块内部函数。示例：(func (export "xx") (param <type>) (result <type>))
 */
function callFunctionModule(){
    WebAssembly.compileStreaming(fetch('./function-module.wasm')).then(mod => {
        console.log(mod)
        const obj = new WebAssembly.Instance(mod);
        console.log(obj,obj.exports.add2(1));
        console.log(obj,obj.exports.add3());
    })
}
/**
 * 1. 在wasm中可以使用import导入js模块，wasm支持多级命名空间，但写法不是a.b.c的形式，而是(import "a" "b" "c" (...))
 * 2. import模块必须写在模块前面！
 */
function importFunction(){
    WebAssembly.compileStreaming(fetch('./import-module.wasm')).then(mod => {
        console.log(mod)
        const obj = new WebAssembly.Instance(mod,{
            js:{
                add:function(a){
                    return a+200;
                }
            }
        });
        console.log(obj,obj.exports.jsAdd());
    })
}
function main() {
    loadEmptyModule();
    loadFunctionModule();
    callFunctionModule();
    importFunction();
}
main()