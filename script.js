const input = document.getElementById('searchInput');
const button = document.getElementById('searchBtn');

function demoSearch() {
  const value = input.value.trim();
  if (!value) {
    input.focus();
    return;
  }
  alert(`Demo search for: ${value}\n\nLive product search will be connected in the next phase.`);
}

button.addEventListener('click', demoSearch);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') demoSearch();
});
