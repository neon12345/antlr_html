var root_funcs = current.queryAll("*:not(Class_declaration) Function_declaration");
println(root_funcs.length);
root_funcs.forEach(el =>{
    
    println(el.query('Function_name').query('Identifier').text());
    
})

//println(JSON.stringify(current.queryAll('Function_call_argument_list > Function_call_argument:nth-child-of(1)').length))
