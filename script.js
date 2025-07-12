// ✅ 设置后端 API 地址：本地用 localhost，部署后自动改用 Render 地址
const API_BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://timevote-backend.onrender.com';  // ← 替换成你的真实 Render 地址

// --- 用户注册 (index.html) ---
document.getElementById('registerForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  localStorage.setItem('username', username);
  window.location.href = 'menu.html';  // ✅ 改为跳转而非 alert
});

// --- 创建事件 (create.html) ---
document.getElementById('createEventForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();

  const title = document.getElementById('eventTitle').value;
  const description = document.getElementById('eventDesc').value;
  const slots = document.getElementById('timeSlots').value.split(',').map(s => s.trim());
  const maxVotesPerUser = parseInt(document.getElementById('maxVotes').value);

  try {
    const res = await fetch(`${API_BASE}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, slots, maxVotesPerUser })
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const event = await res.json();
    localStorage.setItem('eventId', event._id);
    window.location.href = 'vote.html';
  } catch (err) {
    alert('创建事件失败：' + err.message);
  }
});

// --- 投票页面逻辑 (vote.html) ---
if (document.getElementById('voteForm')) {
  window.addEventListener('DOMContentLoaded', async () => {
    const eventId = localStorage.getItem('eventId');
    const res = await fetch(`${API_BASE}/api/event/${eventId}`);
    const event = await res.json();

    const form = document.getElementById('voteForm');
    form.insertAdjacentHTML('afterbegin', `<h3>${event.title}</h3><p>${event.description}</p>`);

    event.slots.forEach(slot => {
      form.innerHTML += `<label><input type="checkbox" value="${slot}"> ${slot}</label><br>`;
    });

    const btn = document.createElement('button');
    btn.textContent = 'Submit Vote';
    btn.type = 'button';
    btn.onclick = async () => {
      const selected = [...document.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.value);
      if (selected.length === 0) return alert('Please select at least one slot.');

      try {
        const res = await fetch(`${API_BASE}/api/vote/${eventId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selectedSlots: selected,
            username: localStorage.getItem('username') || 'Anonymous'
          })
        });

        const data = await res.json();
        if (!res.ok) {
          console.error('❌ 投票失败:', data);
          return alert('投票提交失败，请稍后重试');
        }

        console.log('✅ 投票提交成功:', data);
        alert('Vote submitted!');
        window.location.href = 'result.html';
      } catch (err) {
        console.error('❌ 投票时异常:', err);
        alert('投票过程中发生错误');
      }
    };

    form.appendChild(btn);
  });
}

// --- 结果页面逻辑 ---
if (document.getElementById('resultChart')) {
  window.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('id') || localStorage.getItem('eventId');
    if (!eventId) return alert('❌ 没有指定要查看的事件 ID');

    const res = await fetch(`${API_BASE}/api/event/${eventId}`);
    const event = await res.json();

    const ctx = document.getElementById('resultChart')?.getContext('2d');
    if (!ctx || !event.votes) return alert('加载投票数据失败');

    if (Object.values(event.votes).every(v => v === 0)) {
      document.getElementById('resultChart').insertAdjacentHTML('beforebegin', `
        <p style="color:red;">⚠ 当前没有任何投票结果，请先进行投票。</p>
      `);
      return;
    }

    const labels = Object.keys(event.votes);
    const values = Object.values(event.votes);
    const maxValue = Math.max(...values);

    const barColors = values.map(v => v === maxValue ? 'rgba(255, 99, 132, 0.7)' : 'rgba(52, 152, 219, 0.7)');
    const borderColors = values.map(v => v === maxValue ? 'rgba(255, 99, 132, 1)' : 'rgba(41, 128, 185, 1)');

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '💡 Votes Received',
          data: values,
          backgroundColor: barColors,
          borderColor: borderColors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        animation: {
          duration: 1000,
          easing: 'easeOutBounce'
        },
        plugins: {
          title: {
            display: true,
            text: `🗳 Voting Results for: ${event.title}`,
            font: {
              size: 20
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `📌 ${context.label}: ${context.parsed.y} vote(s)`;
              }
            }
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            },
            title: {
              display: true,
              text: 'Vote Count'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Time Slots'
            }
          }
        }
      }
    });

    const voterSection = document.createElement('div');
    voterSection.innerHTML = '<h3>🧑‍💻 Voter Records:</h3>';

    event.voters?.forEach(v => {
      voterSection.innerHTML += `<p>👤 <b>${v.username}</b> voted for: ${v.selectedSlots.join(', ')}</p>`;
    });

    document.body.appendChild(voterSection);
  });
}
