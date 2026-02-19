package com.itbook.courses_service.controller;

import com.itbook.courses_service.dto.UserBasicDto;
import com.itbook.courses_service.entity.Course;
import com.itbook.courses_service.entity.Enrollment;
import com.itbook.courses_service.service.CourseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    @Autowired
    private CourseService courseService;

    @Value("${user.service.base-url:http://localhost:8001}")
    private String userServiceBaseUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    @GetMapping
    public ResponseEntity<List<Course>> getAllCourses() {
        List<Course> courses = courseService.getAllCourses();
        return ResponseEntity.ok(courses);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Course> getCourseById(@PathVariable Long id) {
        Optional<Course> course = courseService.getCourseById(id);
        return course.map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{courseId}/enroll/{userId}")
    public ResponseEntity<String> enrollUser(@PathVariable Long courseId, @PathVariable Long userId) {
        if (courseService.enrollUser(userId, courseId)) {
            return ResponseEntity.ok("Successfully enrolled");
        }
        return ResponseEntity.badRequest().body("Already enrolled or course not found");
    }

    @GetMapping("/{courseId}/enrolled/{userId}")
    public ResponseEntity<Boolean> isEnrolled(@PathVariable Long courseId, @PathVariable Long userId) {
        return ResponseEntity.ok(courseService.isEnrolled(userId, courseId));
    }

    @GetMapping("/user/{userId}/enrolled")
    public ResponseEntity<List<Enrollment>> getUserEnrollments(@PathVariable Long userId) {
        return ResponseEntity.ok(courseService.getUserEnrollments(userId));
    }

    @GetMapping("/user/{userId}/courses")
    public ResponseEntity<List<Course>> getUserCourses(@PathVariable Long userId) {
        return ResponseEntity.ok(courseService.getCoursesByUserId(userId));
    }

    @GetMapping("/{courseId}/users")
    public ResponseEntity<List<UserBasicDto>> getCourseUsers(@PathVariable Long courseId) {
        List<Enrollment> enrollments = courseService.getCourseEnrollments(courseId);
        if (enrollments.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        List<Long> userIds = enrollments.stream()
                .map(Enrollment::getUserId)
                .distinct()
                .collect(Collectors.toList());

        String ids = userIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        String url = UriComponentsBuilder.fromHttpUrl(userServiceBaseUrl)
                .path("/api/auth/internal/users")
                .queryParam("ids", ids)
                .toUriString();

        ResponseEntity<List<UserBasicDto>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {}
        );

        return ResponseEntity.ok(response.getBody() == null ? Collections.emptyList() : response.getBody());
    }
}