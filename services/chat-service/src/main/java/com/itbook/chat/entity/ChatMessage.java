package com.itbook.chat.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "messages")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column
    private Long userId;

    @Column(nullable = false)
    private Long courseId;

    @Enumerated(EnumType.STRING)
    private Type type;

    private String content;

    private String sender;

    private String originalContent;

    @Column(nullable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP", insertable = false, updatable = false)
    private LocalDateTime timestamp;

    @Column(columnDefinition = "TIMESTAMP")
    private LocalDateTime editedAt;

    @Column(columnDefinition = "JSON")
    private String reactions;

    private Boolean isDeleted = false;

    @Column(columnDefinition = "TIMESTAMP")
    private LocalDateTime deletedAt;
}
