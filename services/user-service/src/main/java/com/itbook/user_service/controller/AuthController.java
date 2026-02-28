package com.itbook.user_service.controller;

import com.itbook.user_service.dto.CourseDto;
import com.itbook.user_service.dto.UserBasicDto;
import com.itbook.user_service.dto.UserWithCoursesDto;
import com.itbook.user_service.entity.User;
import com.itbook.user_service.service.UserService;
import com.itbook.user_service.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Value("${app.upload.dir}")
    private String uploadDir;

    @Value("${courses.service.base-url:http://localhost:8003}")
    private String coursesServiceBaseUrl;

    @Autowired
    private UserService userService;

    @Autowired
    private JwtUtil jwtUtil;

    private final RestTemplate restTemplate = new RestTemplate();

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        try {
            String email = credentials.get("email");
            String password = credentials.get("password");

            User user = userService.authenticateUser(email, password);

            if (user != null) {
                String token = jwtUtil.generateToken(user.getId(), user.getEmail(), user.getFullName());

                Map<String, Object> response = Map.of(
                        "success", true,
                        "token", token,
                        "user", Map.of(
                                "id", user.getId(),
                                "email", user.getEmail(),
                                "name", user.getFullName()
                        )
                );
                return ResponseEntity.ok(response);
            }
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Invalid credentials"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Map<String, String> data) {
        String email = data.get("email");
        String fullName = data.get("fullName");
        String password = data.get("password");
        String confirmPassword = data.get("confirmPassword");

        User existingUser = userService.findUserByEmail(email);
        if (existingUser != null) {
            return ResponseEntity.status(400).body(Map.of("success", false, "message", "Email already exists"));
        }

        if (!password.equals(confirmPassword)) {
            return ResponseEntity.status(400).body(Map.of("success", false, "message", "Passwords don't match"));
        }

        if (!isStrongPassword(password)) {
            return ResponseEntity.status(400).body(Map.of(
                    "success", false,
                    "message", "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol"
            ));
        }

        User newUser = new User();
        newUser.setEmail(email);
        newUser.setFullName(fullName);
        newUser.setPassword(password);
        newUser.setConfirmPassword(confirmPassword);
        userService.saveUser(newUser);

        return ResponseEntity.ok(Map.of("success", true, "message", "Account created"));
    }

    @PostMapping("/resetPassword")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> data) {
        String email = data.get("email");
        String newPassword = data.get("newPassword");
        String confirmNewPassword = data.get("confirmNewPassword");

        User user = userService.findUserByEmail(email);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Email not found"));
        }

        if (!newPassword.equals(confirmNewPassword)) {
            return ResponseEntity.status(400).body(Map.of("success", false, "message", "Passwords don't match"));
        }

        user.setPassword(newPassword);
        user.setConfirmPassword(confirmNewPassword);
        userService.saveUser(user);

        return ResponseEntity.ok(Map.of("success", true, "message", "Password reset successfully"));
    }

    @GetMapping("/verify")
    public ResponseEntity<?> verifyToken(@RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            if (jwtUtil.validateToken(token)) {
                Long userId = jwtUtil.getUserId(token);
                User user = userService.getUserById(userId);

                Map<String, Object> response = new HashMap<>();
                response.put("userId", userId);
                response.put("email", jwtUtil.getEmail(token));
                response.put("name", jwtUtil.getName(token));
                response.put("avatarUrl", user == null ? null : user.getAvatarUrl());

                return ResponseEntity.ok(response);
            }
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        }
        return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
    }

    @PostMapping("/update")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, String> updates,
                                           @RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            Long userId = jwtUtil.getUserId(token);

            User user = userService.getUserById(userId);
            if (user != null) {
                if (updates.containsKey("fullName")) {
                    user.setFullName(updates.get("fullName"));
                }
                userService.saveUser(user);
                return ResponseEntity.ok(Map.of("success", true));
            }
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        }
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> data,
                                            @RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            Long userId = jwtUtil.getUserId(token);

            User user = userService.getUserById(userId);
            if (user == null) {
                return ResponseEntity.status(404).body(Map.of("error", "User not found"));
            }

            String currentPassword = data.get("currentPassword");
            String newPassword = data.get("newPassword");
            String confirmPassword = data.get("confirmPassword");

            if (!user.getPassword().equals(currentPassword)) {
                return ResponseEntity.status(400).body(Map.of("error", "Current password is incorrect"));
            }

            if (!newPassword.equals(confirmPassword)) {
                return ResponseEntity.status(400).body(Map.of("error", "New passwords don't match"));
            }

            user.setPassword(newPassword);
            user.setConfirmPassword(confirmPassword);
            userService.saveUser(user);

            return ResponseEntity.ok(Map.of("success", true, "message", "Password updated"));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        }
    }

    @DeleteMapping("/delete-account")
    public ResponseEntity<?> deleteAccount(@RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            Long userId = jwtUtil.getUserId(token);

            userService.deleteUser(userId);
            return ResponseEntity.ok(Map.of("success", true, "message", "Account deleted"));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        }
    }

    @PostMapping("/upload-avatar")
    public ResponseEntity<?> uploadAvatar(@RequestParam("file") MultipartFile file,
                                          @RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            Long userId = jwtUtil.getUserId(token);

            User user = userService.getUserById(userId);
            if (user == null) {
                return ResponseEntity.status(404).body(Map.of("error", "User not found"));
            }

            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("avatars");
            Files.createDirectories(uploadPath);

            String filename = userId + "_" + System.currentTimeMillis() + ".jpg";
            Path filePath = uploadPath.resolve(filename);
            file.transferTo(filePath.toFile());

            user.setAvatarUrl("/user-service/uploads/avatars/" + filename);
            userService.saveUser(user);

            return ResponseEntity.ok(Map.of("success", true, "avatarUrl", "/uploads/avatars/" + filename));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/internal/users")
    public ResponseEntity<List<UserBasicDto>> getUsersByIds(@RequestParam("ids") String idsParam) {
        List<Long> userIds = parseIds(idsParam);
        if (userIds.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        List<UserBasicDto> users = userService.getUsersByIds(userIds)
                .stream()
                .map(user -> new UserBasicDto(user.getId(), user.getEmail(), user.getFullName(), user.getAvatarUrl()))
                .collect(Collectors.toList());

        return ResponseEntity.ok(users);
    }

    @GetMapping("/{userId}/courses")
    public ResponseEntity<UserWithCoursesDto> getUserWithCourses(@PathVariable Long userId) {
        User user = userService.getUserById(userId);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        String url = coursesServiceBaseUrl + "/api/courses/user/" + userId + "/courses";
        ResponseEntity<List<CourseDto>> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {}
        );

        List<CourseDto> courses = response.getBody() == null ? Collections.emptyList() : response.getBody();

        return ResponseEntity.ok(new UserWithCoursesDto(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getAvatarUrl(),
                courses
        ));
    }

    private boolean isStrongPassword(String password) {
        if (password == null) {
            return false;
        }

        boolean hasLength = password.length() >= 8;
        boolean hasLower = password.chars().anyMatch(Character::isLowerCase);
        boolean hasUpper = password.chars().anyMatch(Character::isUpperCase);
        boolean hasDigit = password.chars().anyMatch(Character::isDigit);
        boolean hasSymbol = password.chars().anyMatch(ch -> !Character.isLetterOrDigit(ch));

        return hasLength && hasLower && hasUpper && hasDigit && hasSymbol;
    }

    private List<Long> parseIds(String idsParam) {
        return java.util.Arrays.stream(idsParam.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(Long::valueOf)
                .collect(Collectors.toList());
    }
}
