mergeInto(LibraryManager.library,{
    js_print_fibonacci:function(ptr,count){
        for(var i = 0; i<count;i++){
            console.log(`js_print ${i}: ${Module.HEAP32[(ptr>>2)+i]}`)
        }
    }
})