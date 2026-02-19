
package com.itbook.courses_service.dto;

import lombok.Data;

@Data
public class UserBasicDto {
    private Long id;
    private String email;
    private String fullName;
    private String avatarUrl;
}