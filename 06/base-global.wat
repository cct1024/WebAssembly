(module
    ;; 全局变量可导入也可导出
    (global $age (import "js" "age") (mut i32))
    ;; 全局变量的声明语法为(global $variable (mut type)|type (initialize))
    (global $level (mut i32) (i32.const 0))
    ;; 声明一个只读全局变量
    (global $id i32 (i32.const 9999))
    ;; 导出一个全局变量
    (export "ID" (global $id) )
    (export "Level" (global $level) )
    (func (export "getAge") (result i32)
        (global.get $age)
    )
    (func (export "setAge") (param $value i32)
        (global.set $age (local.get $value))
    )
)