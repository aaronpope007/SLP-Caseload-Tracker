// Simple test to verify React is loading
console.log('Script is loading!');

const root = document.getElementById('root');
if (root) {
  root.innerHTML = '<div style="padding: 20px; background: red; color: white; font-size: 24px;">If you see this, JavaScript is working!</div>';
  console.log('Root element found and updated');
} else {
  console.error('Root element not found!');
}

