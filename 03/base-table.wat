(module
    ;; 声明一个table，数字2表示的是表格的初始大小（也就是它将存储两个引用）
    (table 2 funcref)
    ;; 元素段(element section)能够将一个模块中的任意函数子集以任意顺序列入其中，并允许重复出现。
    ;; 列入其中的函数将会被表格引用，且引用顺序是其出现的顺序。
    ;; 元素段(element section)中的(i32.const 0) 值是一个偏移量--它需要在元素段开始的位置声明，
    ;; 其作用是表明函数引用在表格中的什么索引位置开始存储的，类似内存读写一样要指定起始位置。
    (elem (i32.const 0) $f1 $f2)
    ;; 以下两个函数声明的位置并不重要
    (func $f1 (result i32)
        i32.const 100
    )
    (func $f2 (result i32)
        i32.const 200
    )
    ;; 定义一个名为return_i32的类型，该类型是一个无参数返回值为i32的函数
    (type $return_i32 (func (result i32)))
    ;; 导出一个函数，通过参数指定要调用的函数索引，该函数返回值类型为i32，因此调用的函数返回值类型必须相同
    (func (export "callByIndex") (param $funcIndex i32) (result i32)
        ;; 通过函数索引调用函数，并指定函数签名类型为$return_i32，以及函数的索引
        ;; 在调用时也可以不使用local.get读取索引到栈中，也可以在调用前读取到栈中也是等价的
        (call_indirect (type $return_i32) (local.get $funcIndex))
    )
    
)