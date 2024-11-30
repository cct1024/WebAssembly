(module
    ;; 导入一个tag，并且接收一个i32类型的参数
    (import "js" "tag" (tag $tagName (param i32)))
    ;; 创建一个函数，接收i32类型参数，并抛出异常，将tag抛出
    ;; 由于tag需要一个参数，因此抛出异常时需要有一个匹配的参数，其实和js抛出异常类似
    (func $throwErr (param $errMsg i32)
        local.get $errMsg
        throw $tagName
    )
    (func (export "run")
        i32.const 44
        call $throwErr
    )
)