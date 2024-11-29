(module
    (func $import_func(import "imports" "import_func") (param i32))
    (func (export "exported_func")
        i32.const 100
        (call $import_func)
    )
)