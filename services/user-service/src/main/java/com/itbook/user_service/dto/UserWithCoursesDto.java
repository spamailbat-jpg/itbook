package com.itbook.user_service.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class UserWithCoursesDto {
    private Long id;
    private String email;
    private String fullName;
    private String avatarUrl;
    private List<CourseDto> courses;
}
