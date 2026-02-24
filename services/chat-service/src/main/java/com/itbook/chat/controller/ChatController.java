package com.itbook.chat.controller;

import com.itbook.chat.entity.ChatMessage;
import com.itbook.chat.service.ChatRoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatRoomService chatRoomService;

    @GetMapping("/courses/{courseId}/messages")
    public ResponseEntity<List<ChatMessage>> getCourseMessages(
            @PathVariable Long courseId,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        if (authHeader == null || authHeader.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        if (!chatRoomService.canAccessCourseChat(courseId, authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<ChatMessage> messages = chatRoomService.getCourseMessages(courseId, authHeader);
        return ResponseEntity.ok(messages);
    }

    @MessageMapping("/chat.join/{courseId}")
    @SendTo("/topic/course/{courseId}")
    public ChatMessage joinRoom(
            @DestinationVariable Long courseId,
            @Payload ChatMessage chatMessage,
            SimpMessageHeaderAccessor headerAccessor,
            @Header(value = "Authorization", required = false) String authHeader
    ) {
        return chatRoomService.handleJoin(courseId, authHeader, headerAccessor);
    }

    @MessageMapping("/chat.send/{courseId}")
    @SendTo("/topic/course/{courseId}")
    public ChatMessage sendMessage(
            @DestinationVariable Long courseId,
            @Payload ChatMessage chatMessage,
            @Header(value = "Authorization", required = false) String authHeader
    ) {
        return chatRoomService.handleMessage(courseId, chatMessage, authHeader);
    }
}
