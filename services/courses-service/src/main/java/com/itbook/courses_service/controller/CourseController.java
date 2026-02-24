package com.itbook.courses_service.controller;

import com.itbook.courses_service.dto.UserBasicDto;
import com.itbook.courses_service.entity.Course;
import com.itbook.courses_service.entity.Enrollment;
import com.itbook.courses_service.service.CourseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Collections;
import java.util.List;
import java.util.Map;
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
        if (course.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        course.get().setStudentsList(getCourseUsers(course.get().getId()).getBody());
        return ResponseEntity.ok(course.get());
    }

    @PostMapping("/{courseId}/enroll/{userId}")
    public ResponseEntity<String> enrollUser(
            @PathVariable Long courseId,
            @PathVariable Long userId,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        if (courseService.getCourseById(courseId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        if (authHeader != null && !authHeader.isBlank()) {
            Long tokenUserId = getUserIdFromToken(authHeader);
            if (tokenUserId == null) {
                return ResponseEntity.status(401).body("Invalid token");
            }
            if (!tokenUserId.equals(userId)) {
                return ResponseEntity.status(403).body("You can only enroll yourself");
            }
        }

        if (!userExists(userId)) {
            return ResponseEntity.badRequest().body("User not found");
        }

        if (courseService.enrollUser(userId, courseId)) {
            return ResponseEntity.ok("Successfully enrolled");
        }
        return ResponseEntity.badRequest().body("Already enrolled");
    }

    @GetMapping("/{courseId}/enrolled/{userId}")
    public ResponseEntity<Boolean> isEnrolled(@PathVariable Long courseId, @PathVariable Long userId) {
        return ResponseEntity.ok(courseService.isEnrolled(userId, courseId));
    }

    @GetMapping("/user/{userId}/enrolled")
    public ResponseEntity<List<Enrollment>> getUserEnrollments(@PathVariable Long userId) {
        if (!userExists(userId)) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        return ResponseEntity.ok(courseService.getUserEnrollments(userId));
    }

    @GetMapping("/user/{userId}/courses")
    public ResponseEntity<List<Course>> getUserCourses(@PathVariable Long userId) {
        if (!userExists(userId)) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        List<Course> courses = courseService.getCoursesByUserId(userId);
        courses.forEach(course -> course.setStudentsList(getCourseUsers(course.getId()).getBody()));
        return ResponseEntity.ok(courses);
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

        List<UserBasicDto> users = fetchUsersByIds(userIds);
        return ResponseEntity.ok(users);
    }

    @GetMapping("/{courseId}/students")
    public ResponseEntity<List<UserBasicDto>> getCourseStudents(@PathVariable Long courseId) {
        return getCourseUsers(courseId);
    }

    private boolean userExists(Long userId) {
        List<UserBasicDto> users = fetchUsersByIds(List.of(userId));
        return users.stream().anyMatch(user -> userId.equals(user.getId()));
    }

    private List<UserBasicDto> fetchUsersByIds(List<Long> userIds) {
        if (userIds.isEmpty()) {
            return Collections.emptyList();
        }

        String ids = userIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        String url = UriComponentsBuilder.fromHttpUrl(userServiceBaseUrl)
                .path("/api/auth/internal/users")
                .queryParam("ids", ids)
                .toUriString();

        try {
            ResponseEntity<List<UserBasicDto>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<>() {}
            );
            return response.getBody() == null ? Collections.emptyList() : response.getBody();
        } catch (RestClientException e) {
            return Collections.emptyList();
        }
    }

    private Long getUserIdFromToken(String authHeader) {
        String verifyUrl = UriComponentsBuilder.fromHttpUrl(userServiceBaseUrl)
                .path("/api/auth/verify")
                .toUriString();

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", authHeader);

        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    verifyUrl,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    new ParameterizedTypeReference<>() {}
            );

            Object userId = response.getBody() == null ? null : response.getBody().get("userId");
            if (userId instanceof Number number) {
                return number.longValue();
            }
            return null;
        } catch (RestClientException e) {
            return null;
        }
    }
}
