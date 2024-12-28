mergeInto(LibraryManager.library,{
    NewShape:function(){
        const obj = new Module.Shape();
        return obj.id;
    },
    call_shape:function(id,name){
        console.log('call',id,name)
        Module.call_shape(id,Module.UTF8ToString(name));
    }
})