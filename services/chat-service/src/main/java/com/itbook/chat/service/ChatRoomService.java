package com.itbook.chat.service;

import com.itbook.chat.entity.ChatMessage;
import com.itbook.chat.entity.Type;
import com.itbook.chat.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ChatRoomService {

    private final ChatMessageRepository chatMessageRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${user.service.base-url:http://localhost:8001}")
    private String userServiceBaseUrl;

    @Value("${courses.service.base-url:http://localhost:8003}")
    private String coursesServiceBaseUrl;

    public ChatMessage handleJoin(Long courseId, String authorizationHeader, SimpMessageHeaderAccessor headerAccessor) {
        Long userId = getUserIdFromToken(authorizationHeader);
        if (userId == null || !isUserEnrolled(courseId, userId, authorizationHeader)) {
            throw new IllegalArgumentException("Only enrolled students can join this course chat");
        }

        String displayName = fetchDisplayName(userId);
        if (headerAccessor.getSessionAttributes() != null) {
            headerAccessor.getSessionAttributes().put("username", displayName);
        }

        return ChatMessage.builder()
                .type(Type.JOIN)
                .courseId(courseId)
                .userId(userId)
                .sender(displayName)
                .content(displayName + " joined the chat")
                .build();
    }

    public ChatMessage handleMessage(Long courseId, ChatMessage incoming, String authorizationHeader) {
        Long userId = getUserIdFromToken(authorizationHeader);
        if (userId == null || !isUserEnrolled(courseId, userId, authorizationHeader)) {
            throw new IllegalArgumentException("Only enrolled students can send messages in this course chat");
        }

        String displayName = fetchDisplayName(userId);
        ChatMessage message = ChatMessage.builder()
                .userId(userId)
                .courseId(courseId)
                .sender(displayName)
                .content(incoming.getContent())
                .originalContent(incoming.getOriginalContent())
                .type(incoming.getType() == null ? Type.CHAT : incoming.getType())
                .build();

        return chatMessageRepository.save(message);
    }

    public List<ChatMessage> getCourseMessages(Long courseId, String authorizationHeader) {
        Long userId = getUserIdFromToken(authorizationHeader);
        if (userId == null || !isUserEnrolled(courseId, userId, authorizationHeader)) {
            return Collections.emptyList();
        }
        return chatMessageRepository.findByCourseIdOrderByTimestampAsc(courseId);
    }

    public boolean canAccessCourseChat(Long courseId, String authorizationHeader) {
        Long userId = getUserIdFromToken(authorizationHeader);
        return userId != null && isUserEnrolled(courseId, userId, authorizationHeader);
    }

    private Long getUserIdFromToken(String authHeader) {
        if (authHeader == null || authHeader.isBlank()) {
            return null;
        }

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

    private boolean isUserEnrolled(Long courseId, Long userId, String authHeader) {
        String enrolledUrl = UriComponentsBuilder.fromHttpUrl(coursesServiceBaseUrl)
                .path("/api/courses/{courseId}/enrolled/{userId}")
                .buildAndExpand(courseId, userId)
                .toUriString();

        HttpHeaders headers = new HttpHeaders();
        if (authHeader != null && !authHeader.isBlank()) {
            headers.set("Authorization", authHeader);
        }

        try {
            ResponseEntity<Boolean> response = restTemplate.exchange(
                    enrolledUrl,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    Boolean.class
            );
            return Boolean.TRUE.equals(response.getBody());
        } catch (RestClientException e) {
            return false;
        }
    }

    private String fetchDisplayName(Long userId) {
        String usersUrl = UriComponentsBuilder.fromHttpUrl(userServiceBaseUrl)
                .path("/api/auth/internal/users")
                .queryParam("ids", userId)
                .toUriString();

        try {
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    usersUrl,
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<>() {}
            );

            List<Map<String, Object>> users = response.getBody();
            if (users == null || users.isEmpty()) {
                return "User " + userId;
            }

            Object fullName = users.get(0).get("fullName");
            if (fullName instanceof String name && !name.isBlank()) {
                return name;
            }

            Object email = users.get(0).get("email");
            if (email instanceof String emailValue && !emailValue.isBlank()) {
                return emailValue;
            }
        } catch (RestClientException ignored) {
            // fall back to generic name
        }

        return "User " + userId;
    }
}
