let courses = [];

async function loadCourses() {
    try {
        const response = await fetch(`${GATEWAY_URL}/courses-service/api/courses`);
        if (!response.ok) throw new Error('Failed to fetch courses');
        courses = await response.json();
        document.getElementById('loading').style.display = 'none';
        displayCourses(courses);
    } catch (error) {
        console.error('Error loading courses:', error);
        document.getElementById('loading').innerHTML = '<div class="error-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load courses. Please try again later.</p></div>';
    }
}
async function enrollCourse(event, courseId) {
    event.stopPropagation();

    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    if (!token || !user?.id) {
        alert('Please login first');
        window.location.href = '/login.html';
        return;
    }

    try {
        const response = await fetch(`${GATEWAY_URL}/courses-service/api/courses/${courseId}/enroll/${user.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const message = await response.text();

        if (!response.ok && !message.toLowerCase().includes('already enrolled')) {
            alert(message || 'Failed to enroll');
            return;
        }

        if (message) {
            alert(message);
        }

        goToCourse(courseId);
    } catch (error) {
        console.error('Error enrolling:', error);
        alert('Failed to enroll');
    }
}

function goToCourse(courseId) {
    window.location.href = `/course-detail.html?id=${courseId}`;
}

function displayCourses(coursesToDisplay) {
    const grid = document.getElementById('coursesGrid');
    grid.innerHTML = '';

    if (coursesToDisplay.length === 0) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No courses found matching your search.</p></div>';
        return;
    }

    coursesToDisplay.forEach((course, index) => {
        const card = document.createElement('div');
        card.className = 'course-card';
        card.style.animationDelay = `${index * 0.1}s`;
        card.innerHTML = `
            <div class="course-card-inner">
                <div class="course-image">
                    <img src="/img/courses/${course.image}" alt="${course.title}" onerror="this.style.display='none'">
                    <div class="course-overlay">
                        <button class="quick-view-btn" onclick="goToCourse(${course.id})">
                            <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
                <div class="course-content">
                    <div class="course-header">
                        <span class="course-category">Computer Science</span>
                        <div class="course-rating">
                            <i class="fas fa-star"></i>
                            <span>4.8</span>
                        </div>
                    </div>
                    <h3 class="course-title">${course.title}</h3>
                    <p class="course-description">${course.description}</p>
                    <div class="course-footer">
                        <div class="course-meta">
                            <div class="meta-item">
                                <i class="fas fa-users"></i>
                                <span>${course.students}</span>
                            </div>
                            <div class="meta-item">
                                <i class="fas fa-clock"></i>
                                <span>12 weeks</span>
                            </div>
                        </div>
                        <button class="enroll-btn" onclick="enrollCourse(event, ${course.id})">
                            <span>Enroll</span>
                            <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        card.onclick = (e) => {
            if (!e.target.closest('.enroll-btn') && !e.target.closest('.quick-view-btn')) {
                goToCourse(course.id);
            }
        };
        grid.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = courses.filter(course =>
            course.title.toLowerCase().includes(query) ||
            course.description.toLowerCase().includes(query)
        );
        displayCourses(filtered);
    });
    loadCourses();
});