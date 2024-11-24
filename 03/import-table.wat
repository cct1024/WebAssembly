(module
    ;; 导入talbe，需要指定最小table大小以及
    table中的类型，externref是js内置函数类型，funcref是wasm内置函数类型
    (import "js" "table" (table 2 externref))
    ;; 定义一个名为return_i32的类型，该类型是一个无参数返回值为i32的函数
    (type $return_i32 (func (result i32)))
    ;; 导出一个函数，通过参数指定要调用的函数索引，该函数返回值类型为i32，因此调用的函数返回值类型必须相同
    (func (export "callByIndex") (param $funcIndex i32) (result i32)
        ;; 通过函数索引调用函数，并指定函数签名类型为$return_i32，以及函数的索引
        ;; 在调用时也可以不使用local.get读取索引到栈中，也可以在调用前读取到栈中也是等价的
        ;;(call_indirect (type $return_i32) (local.get $funcIndex))
        i32.const 22
    )

)