const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://gntpxffonjvnvadjclpl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdudHB4ZmZvbmp2bnZhZGpjbHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MzA4NzEsImV4cCI6MjA5MDQwNjg3MX0.hLDucOsGEci6iWq7eHS6RsQIZEpipBxjuqlep5f9Pcs');

async function test() {
  const email = 'test' + Date.now() + '@example.com';
  // I will just use the anon key to query profiles without auth
  const start = Date.now();
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .limit(1);
    
  console.log('Profiles query took:', Date.now() - start, 'ms');
  console.log('Result:', { data, error });
}

test();
