#include <stdio.h>
// emcc module.cc -o module.js -s ALLOW_MEMORY_GROWTH=1 -s IMPORTED_MEMORY=1 -s TOTAL_MEMORY=655360  --pre-js pre.js --post-js post.js
int main(){
    printf("hello\n");
    return 0;
}