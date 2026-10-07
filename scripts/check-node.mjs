const major=Number(process.versions.node.split('.')[0]);
if(major<24){console.error('Garimpo precisa do Node.js 24 ou superior. Confira com: node -v');process.exit(1);}
