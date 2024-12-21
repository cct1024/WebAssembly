/**
 * 1. mergeInto方法及LibraryManager都是编译器内置的模块方法，通过它们可以将js中的方法导入C中
 */
mergeInto(LibraryManager.library,{
    js_add:function(a,b){
        console.log('js add');
        return a+b;
    },
    js_console_log_int:function(a){
        console.log('js int: ',a);
    }
})