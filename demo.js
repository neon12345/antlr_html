var root_funcs = current.queryAll("Class_body Function_declaration");
println('number of class mehtods: ' + root_funcs.length);
root_funcs.forEach(el =>{
    println('mehtod name: ' + el.query('Function_name').query('Identifier').text());
})
