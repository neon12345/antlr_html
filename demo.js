var root_funcs = current.queryAll("Class_body Function_declaration");
println('number of class methods: ' + root_funcs.length);
root_funcs.forEach(el =>{
    println('method name: ' + el.query('Function_name').query('Identifier').text());
})
