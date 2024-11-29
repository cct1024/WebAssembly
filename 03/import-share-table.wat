(module
    (table (import "js" "table") 2 funcref)
    (type $fn (func (param i32) (param i32) (result i32)))
    (func (export "callShareFuncByIndex") (param $index i32) (param $a i32) (param $b i32) (result i32)
        local.get $a
        local.get $b
        (call_indirect (type $fn) (local.get $index))
    )
)