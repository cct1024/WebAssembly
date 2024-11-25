(module
    ;; 目前wasm中只能有一个table，要么用funcref要么用externref。
    ;; 而table是可以被共享的，因此可以通过table共享函数引用给其它wasm。
    ;; 导入js中的table，表中至少有2个元素
    (import "js" "table" (table 2 externref))
    ;; 导入js中的apply函数，该函数的第一个参数为externref类型，返回为i32类型
    (import "js" "apply" (func $apply(param externref) (result i32)))
    (type $callback (func (result i32)))
    (func (export "callByIndex") (param $index i32) (result i32)
        ;; 调用js apply函数，根据索引从table获取externref作为参数
        (call $apply (table.get (local.get $index)))
    )
)