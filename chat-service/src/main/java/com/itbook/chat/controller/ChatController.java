package com.itbook.chat.controller;

import com.itbook.chat.entity.ChatMessage;
import com.itbook.chat.repository.ChatMessageRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final ChatMessageRepository chatMessageRepository;
    private final SimpMessageSendingOperations simpMessageSendingOperations;
    private final ObjectMapper objectMapper;

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage) {
        chatMessage.setTimestamp(LocalDateTime.now());
        chatMessage.setReactions("{}");
        chatMessageRepository.save(chatMessage);
        return chatMessage;
    }

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(@Payload ChatMessage chatMessage,
                               SimpMessageHeaderAccessor simpMessageHeaderAccessor) {
        simpMessageHeaderAccessor.getSessionAttributes().put("username", chatMessage.getSender());
        chatMessage.setTimestamp(LocalDateTime.now());
        chatMessageRepository.save(chatMessage);
        return chatMessage;
    }

    @MessageMapping("/chat.editMessage")
    @SendTo("/topic/public")
    public ChatMessage editMessage(@Payload ChatMessage chatMessage) {
        ChatMessage existingMessage = chatMessageRepository.findById(chatMessage.getId())
                .orElseThrow(() -> new RuntimeException("Message not found"));

        existingMessage.setOriginalContent(existingMessage.getContent());
        existingMessage.setContent(chatMessage.getContent());
        existingMessage.setEditedAt(LocalDateTime.now());

        chatMessageRepository.save(existingMessage);
        existingMessage.setType(Type.MESSAGE);
        return existingMessage;
    }

    @MessageMapping("/chat.deleteMessage")
    @SendTo("/topic/public")
    public ChatMessage deleteMessage(@Payload ChatMessage chatMessage) {
        ChatMessage existingMessage = chatMessageRepository.findById(chatMessage.getId())
                .orElseThrow(() -> new RuntimeException("Message not found"));

        existingMessage.setIsDeleted(true);
        existingMessage.setDeletedAt(LocalDateTime.now());
        existingMessage.setContent("This message was deleted");

        chatMessageRepository.save(existingMessage);
        return existingMessage;
    }

    @MessageMapping("/chat.addReaction")
    @SendTo("/topic/public")
    public ChatMessage addReaction(@Payload ChatMessage chatMessage) {
        ChatMessage existingMessage = chatMessageRepository.findById(chatMessage.getId())
                .orElseThrow(() -> new RuntimeException("Message not found"));

        try {
            Map<String, Integer> reactions = objectMapper.readValue(
                    existingMessage.getReactions(),
                    Map.class
            );

            String emoji = chatMessage.getOriginalContent();
            reactions.put(emoji, reactions.getOrDefault(emoji, 0) + 1);

            existingMessage.setReactions(objectMapper.writeValueAsString(reactions));
            chatMessageRepository.save(existingMessage);

        } catch (Exception e) {
            e.printStackTrace();
        }

        return existingMessage;
    }

    @MessageMapping("/chat.removeReaction")
    @SendTo("/topic/public")
    public ChatMessage removeReaction(@Payload ChatMessage chatMessage) {
        ChatMessage existingMessage = chatMessageRepository.findById(chatMessage.getId())
                .orElseThrow(() -> new RuntimeException("Message not found"));

        try {
            Map<String, Integer> reactions = objectMapper.readValue(
                    existingMessage.getReactions(),
                    Map.class
            );

            String emoji = chatMessage.getOriginalContent();
            if (reactions.containsKey(emoji)) {
                int count = reactions.get(emoji);
                if (count <= 1) {
                    reactions.remove(emoji);
                } else {
                    reactions.put(emoji, count - 1);
                }
            }

            existingMessage.setReactions(objectMapper.writeValueAsString(reactions));
            chatMessageRepository.save(existingMessage);

        } catch (Exception e) {
            e.printStackTrace();
        }

        return existingMessage;
    }
}