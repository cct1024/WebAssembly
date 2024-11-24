(module  
    (func $add (param $a i32) (param $b i32) (result i32)
        ;; 读取变量a压入栈顶
        local.get $a
        ;; 读取变量b压入栈顶
        local.get $b
        ;; 从栈中读取两个值，即a和b的值，将a与b求和，并将求和结果压入栈
        i32.add    
        ;; 返回值为i32类型，故从栈中取出刚才a与b的和，至此栈也就清空了
    )
    (export "add" (func $add))
    (func $add2 (param $a i32) (result i32)
        ;; 读取变量a压入栈
        local.get $a
        ;; 声明局部变量压入栈
        i32.const 100
        ;; $add函数接收两个参数，因此在执行call $add前需要保证栈上有两个值，且这两个值的类型符合$add函数的参数签名
        call $add
    )
    (export "add2" (func $add2))
    (func $get99 (result i32)
        i32.const 99
    )
    ;; 也可以通过此方式导出函数
    (func (export "add3") (result i32)
        call $get99
        i32.const 1
        call $add
    )
)