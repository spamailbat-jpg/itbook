package com.itbook.courses_service.service;

import com.itbook.courses_service.entity.Course;
import com.itbook.courses_service.entity.Enrollment;
import com.itbook.courses_service.repository.CourseRepository;
import com.itbook.courses_service.repository.EnrollmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class CourseService {

    @Autowired
    private CourseRepository courseRepository;
    @Autowired
    private EnrollmentRepository enrollmentRepository;

    public List<Course> getAllCourses() {
        List<Course> courses = courseRepository.findAll();
        courses.forEach(this::applyRealStudentCount);
        return courses;
    }

    public Optional<Course> getCourseById(Long id) {
        Optional<Course> course = courseRepository.findById(id);
        course.ifPresent(this::applyRealStudentCount);
        return course;
    }

    public Course saveCourse(Course course) {
        return courseRepository.save(course);
    }

    public void deleteCourse(Long id) {
        courseRepository.deleteById(id);
    }

    public boolean isEnrolled(Long userId, Long courseId) {
        return enrollmentRepository.existsByUserIdAndCourseId(userId, courseId);
    }

    public boolean enrollUser(Long userId, Long courseId) {
        if (isEnrolled(userId, courseId)) {
            return false;
        }

        Course course = courseRepository.findById(courseId).orElse(null);
        if (course == null) {
            return false;
        }

        Enrollment enrollment = new Enrollment();
        enrollment.setUserId(userId);
        enrollment.setCourse(course);
        enrollmentRepository.save(enrollment);

        applyRealStudentCount(course);

        return true;
    }

    public List<Enrollment> getUserEnrollments(Long userId) {
        return enrollmentRepository.findByUserId(userId);
    }

    public List<Enrollment> getCourseEnrollments(Long courseId) {
        return enrollmentRepository.findByCourseId(courseId);
    }

    public List<Course> getCoursesByUserId(Long userId) {
        List<Enrollment> enrollments = enrollmentRepository.findByUserId(userId);
        List<Course> courses = new ArrayList<>();

        for (Enrollment enrollment : enrollments) {
            Course course = enrollment.getCourse();
            applyRealStudentCount(course);
            courses.add(course);
        }

        return courses;
    }

    private void applyRealStudentCount(Course course) {
        long realStudents = enrollmentRepository.countByCourseId(course.getId());
        course.setStudents(Math.toIntExact(realStudents));
    }
}