(module
    ;; 导入一个js函数，接收两个参数，一个为内存指针，另一个为字节长度
    (import "console" "string" (func $log(param $ptr i32) (param $length i32) ))
    ;; 导入一个js内存实例，要求内存大小至少为1页，每页64kb
    (import "js" "memory" (memory 1))
    ;; 向内存中写入数据，数据类型为字节序列，写入的起始位置为0
    (data (i32.const 0) "Hello world!")
    (func (export "writeString")
        ;; 向栈入压入0作为内存指针起始位置
        i32.const 0
        ;; 向栈中压入12作为字节长度
        i32.const 12
        ;; 调用js函数
        call $log
    )
)