/**
 * 1. 表格是从wasm代码中通过索引获取的可变大小的引用数组。
 * 为了了解为什么表格是必须的，首先需要观察前面看到的call指令，它接受一个静态函数索引，并且只调用了一个函数--但是，如果被调用者是一个运行时值呢？
 * 1.1 在js中，我们总是看到：函数是一等值。
 * 1.2 在c/c++中，我们看到了函数指针。
 * 1.3 在c++中，我们看到了虚函数。
 * 也就是说，静态函数的索引在编译时就已经确定了，但运行时的函数引用是动态的，也可称为是动态函数，需要能获取到这些动态函数的索引。
 * 2. wasm需要一种做到这一点的调用指令，因此，我们有了接受一个动态函数操作数的call_indirect指令。问题是，在wasm中，当前操作数的仅有的工是i32/f32/i64/f64。
 * wasm中可以增加一个anyfunc类型（any的含义是该类型能够持有任何签名的函数），但是，不幸的是，由于安全原因，这个anyfunc类型不能存储在线性内存中。
 * 线性内存会把存储的内容作为字节暴露出去，并且这会使得wasm内容能够任意的查看和修改原始函数地址，而这在网络上是不被允许的。
 * 3. 解决方案是在一个表格中存储函数引用，然后作为代替，传递表格索引--它们只是i32类型值。因此，call_indirect的操作数可以是一个i32类型索引值。
 * 而目前anyfunc类型并不可用，而是替换成了funcref类型。
 * 4. 在js中也可以创建WebAssembly.Table()实例，并通过set方法保存函数引用
 * 5. 在wasm中通过索引调用函数的方法是：(call_indirect (type $name) (i32)) ，第二个参数为要调用的函数签名类型名称，需要先用(type $name (func ...))声明函数签名类型，后面的参数是i32类型，也就是函数的索引。
 * 6. 是什么把call_indirect指令和我们要用的不及格联系起来的呢？答案是，现在每一个模块实例只允许唯一一个表格存在，这也是call_indirect指令隐式地使用的表格。
 * 在将来，当多表格被允许了，我们需要在代码运行中指明一个某种形式的表格标签符。
 */
function functionRefTable() {
    WebAssembly.compileStreaming(fetch("base-table.wasm")).then(mod => {
        const memory = new WebAssembly.Memory({ initial: 1 });
        const obj = new WebAssembly.Instance(mod, {
        });
        console.log(mod, obj)
        // 在wasm的table中有两个函数，一个返回100，另一个返回200
        // 通过wasm暴露的函数可以通过table中的索引值调用函数
        console.log(obj.exports.callByIndex(0))
        console.log(obj.exports.callByIndex(1))
    })
}
/**
 * 1. table中即可以保存wasm中的函数引用，也可以保存js中的函数引用。
 * 2. 由于table目前只能有一个，要么导入js中的表格，要么导出wasm中的表格。
 * 3. 
 */
function importTable() {
    WebAssembly.compileStreaming(fetch('import-table.wasm')).then(mod => {
        // 保存js内置函数时element类型只能是externref
        const table = new WebAssembly.Table({ initial: 2, element: 'externref' });
        table.set(0, () => 100);
        table.set(1, () => 200);
        const obj = new WebAssembly.Instance(mod, {
            js: {
                table: table,
                // wasm不能直接调用table中的externref，只能让wasm获取到table中的externref
                // 然后调用js函数，并将获取到的externref作为js函数的参数，由js自己来调用
                apply: (callback) => {
                    return callback()
                }
            }
        })
        console.log(mod)
        console.log(obj.exports.callByIndex(0))
    })
}
function main() {
    functionRefTable();
    importTable();
}
main();