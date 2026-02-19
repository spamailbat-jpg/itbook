package com.itbook.user_service.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class UserBasicDto {
    private Long id;
    private String email;
    private String fullName;
    private String avatarUrl;
}
