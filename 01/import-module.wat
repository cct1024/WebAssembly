(module
    ;; import语句必须写在前面！
    (import "js" "add" (func $jsAdd (param i32) (result i32)))
    (func (export "jsAdd") (result i32)
        i32.const 110
        call $jsAdd
    )
)