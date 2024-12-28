#include "macro.cc"
// emcc import.cc --js-library shape.js -o import.js -s 'EXPORTED_FUNCTIONS=["UTF8ToString"]'
struct JS_SHAPE;
// 由js提供的函数
EM_PORT_API(struct JS_SHAPE *)
NewShape();
EM_PORT_API(void)
call_shape(struct JS_SHAPE *shape, const char *name);
EM_PORT_API(struct JS_SHAPE *)
CreateShape()
{
    JS_SHAPE *shape = NewShape();
    return shape;
}
EM_PORT_API(void)
call_js_shape(struct JS_SHAPE *shape, const char *func)
{
    const char *fn = "say";
    call_shape(shape, fn);
}