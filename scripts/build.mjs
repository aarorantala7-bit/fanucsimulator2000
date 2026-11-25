import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
let html=readFileSync('index.html','utf8');
html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,p)=>'<style>'+readFileSync(p,'utf8')+'</style>');
html=html.replace('assets/logo.png','data:image/png;base64,'+readFileSync('assets/logo.png').toString('base64'));
html=html.replace(/<script src="([^"]+)"><\/script>/g,(_,p)=>'<script>\n'+readFileSync(p,'utf8')+'</script>');
mkdirSync('dist',{recursive:true});
writeFileSync('dist/FANUC_Simulator_2000_v013.html',html);
console.log('Built standalone preview.');
